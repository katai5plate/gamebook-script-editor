import { KEYWORD_MAP } from "./constants.js";

const tokenizeLine = (line) => {
  const tokens = [];
  const regex = /"[^"]*"|[^\s]+/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    let token = match[0];
    if (token.startsWith('"') && token.endsWith('"')) {
      token = token.slice(1, -1);
      tokens.push(`"${token}`);
      continue;
    }
    tokens.push(token);
  }
  return tokens;
};

const gotoTokenListToCommandItem = (gtl) => {
  const page = gtl.find(
    (t) => t.type === "page" || t.value === "HERE" || t.value === "BACK"
  );
  const cond = gtl.filter((t) => t.type === "condition");
  const eff = gtl.filter((t) => t.type === "effect");
  return {
    page: page.type === "address" ? null : page.value,
    noMove: page.value === "HERE",
    toBack: page.value === "BACK",
    conditions: cond.map(({ formula, flags }) => ({
      formula,
      flags,
    })),
    effects: eff.map(({ formula, flags }) => ({
      formula,
      flags,
    })),
  };
};

export const parser = () => {
  const script = window.editor.getValue();
  const flagNames = new Set();
  const pageNames = new Set();

  // トークン化
  const tokenized = script
    .split("\n")
    .map((line) => {
      const trimmed = line.trim().replace(/\/\/.*?$/, "");
      const [, isMessage] = trimmed.match(/^([>-])/) ?? [];
      const [, isMessageWithCondition] =
        trimmed.match(/^[a-zA-Z0-9_$-\s:]+?([>-])/) ?? [];
      if (isMessage || isMessageWithCondition) {
        const [left, right = ""] = trimmed.split(/[>-]\s?/);
        return [
          isMessage || isMessageWithCondition,
          ...left.split(/\s/).filter((cond) => cond !== "" || cond.length),
          `"${right}`,
        ];
      }
      return tokenizeLine(trimmed);
    })
    .filter((tokens) => tokens.length)
    .map((tokens) =>
      tokens.map((token) => {
        switch (token[0]) {
          case "@": {
            const value = token.slice(1);
            if (value[0] === "^") {
              return { type: "address", value: value.slice(1) };
            }
            pageNames.add(value);
            return { type: "page", value };
          }
          case "$": {
            const value = token.slice(1);
            flagNames.add(value);
            return { type: "flag", value };
          }
          case "/": {
            return { type: "special", value: token.slice(1) };
          }
          case '"': {
            return { type: "text", value: token.slice(1) };
          }
          case "#": {
            return { type: "exec", value: token.slice(1) };
          }
          default: {
            if (KEYWORD_MAP.COMMAND.includes(token))
              return { type: "command", value: token };
            if (KEYWORD_MAP.CONDITION.includes(token.replace(/:.*?$/, ":"))) {
              const [formula, flags] = token.split(":");
              return {
                type: "condition",
                formula,
                flags: flags.split(",").map((flag) => flag.slice(1)),
              };
            }
            if (KEYWORD_MAP.EFFECT.includes(token.replace(/:.*?$/, ":"))) {
              const [formula, flags] = token.split(":");
              return {
                type: "effect",
                formula,
                flags: flags.split(",").map((flag) => flag.slice(1)),
              };
            }
            if (KEYWORD_MAP.TIME.includes(token)) {
              const [, value] = token.split(":");
              return { type: "time", value };
            }
            if ([">", "-"].includes(token))
              return { type: "line", isFirst: token === ">" };
            return { type: "other", value: token };
          }
        }
      })
    );

  // DEFINE/PAGE行か末尾かで捜査してページを取得
  const tokenizedPages = [];
  let tempPage = [];
  const TEMP_CHOICE_TOKEN = () => ({ type: "choice", time: null, options: [] });
  let tempChoiceToken = { ...TEMP_CHOICE_TOKEN() };
  tokenized.forEach((tokens) => {
    const { value } = tokens[0];
    if (["DEFINE", "PAGE"].includes(value)) {
      if (tempPage.length) tokenizedPages.push(tempPage);
      tempPage = [tokens];
    } else {
      if (value === "CHOICE") {
        tempChoiceToken = {
          ...TEMP_CHOICE_TOKEN(),
          time: tokens.find((t) => t.type === "time")?.value ?? null,
        };
      } else if (value === "IS") {
        tempChoiceToken.options.push(tokens);
      } else {
        if (tempChoiceToken.options.length) {
          tempPage.push([tempChoiceToken]);
          tempChoiceToken = { ...TEMP_CHOICE_TOKEN() };
        }
        tempPage.push(tokens);
      }
    }
  });
  tokenizedPages.push(tempPage);

  // ページ辞書化
  const pages = tokenizedPages.slice(1).reduce((p, page) => {
    const [headTokens, ...restTokens] = page;
    const { value } = headTokens[1];
    const commands = restTokens.map((list) => {
      const head = list[0];
      switch (head.value) {
        case "TO":
          return gotoTokenListToCommandItem(list);
        case "EXEC":
          return {
            type: "exec",
            func: list[1].value,
            args: list.slice(2),
          };
        case "RETURN":
          return { type: "page-end", mode: "return" };
        case "BACK":
          return { type: "page-end", mode: "back" };
        default: {
          switch (head.type) {
            case "line": {
              const cond = list.filter((t) => t.type === "condition");
              return {
                ...list[0],
                conditions: cond.map(({ formula, flags }) => ({
                  formula,
                  flags,
                })),
                text: list.find((t) => t.type === "text").value,
              };
            }
            case "choice": {
              let prevText = "";
              return {
                type: "choice",
                time: list[0].time,
                options: list[0].options.map((tokens) => {
                  const text = tokens.find(
                    (t) =>
                      t.type === "text" ||
                      KEYWORD_MAP.SPECIAL.map((x) => x.slice(1)).includes(
                        t.value
                      )
                  );
                  prevText = text.value === "SAME" ? prevText : text.value;
                  return {
                    text: ["CANCEL", "TIMEUP"].includes(prevText)
                      ? null
                      : prevText,
                    wasCancel: text.value === "CANCEL",
                    wasTimeup: text.value === "TIMEUP",
                    ...gotoTokenListToCommandItem(tokens),
                  };
                }),
              };
            }
          }
        }
      }
    });
    return { ...p, [value]: commands };
  }, {});

  return {
    name: tokenized.find((line) => line[0].value === "DEFINE")[1].value,
    flagNames: [...flagNames],
    pageNames: [...pageNames],
    pages,
  };
};
