// "Ask the newsroom" (lib/ask.ts): the page around the conversation (components/Ask.tsx)
import Frame from "../components/Frame.tsx";
import Ask from "../components/Ask.tsx";
import { t } from "../lib/i18n.ts";
import type { Lang } from "../lib/types.ts";

export function AskPage({ lang }: { lang: Lang }) {
  const words = {
    placeholder: t(lang, "askPlaceholder"), send: t(lang, "askSend"), mic: t(lang, "askMic"), listening: t(lang, "askListening"),
    thinking: t(lang, "askThinking"), sources: t(lang, "askSources"), note: t(lang, "askNote"), tries: t(lang, "askTry").split("|"),
    again: t(lang, "askNew"), stop: t(lang, "askStop"), listen: t(lang, "listen"), listenStop: t(lang, "listenStop"), failed: t(lang, "askFailed"), lost: t(lang, "askLost"), retry: t(lang, "askRetry"),
  };
  return (
    <Frame lang={lang} path="/ask" bottomBar={false}>
      {/* no bottom tab bar: the question bar takes its place, as the reading bar does on a story */}
      <div className="sechead"><h1>{t(lang, "askTitle")}</h1></div>
      <p className="askintro">{t(lang, "askIntro")}</p>
      <Ask lang={lang} words={words} />
    </Frame>
  );
}
