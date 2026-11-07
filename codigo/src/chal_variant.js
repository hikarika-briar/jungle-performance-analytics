// Textos e tema das páginas de comparação: "Rumo ao Challenger" (Challengers do BR) e
// "Mono Briar" (os melhores Briar do mundo). A página que está aberta define a variante.
export const VARIANTS = {
  challenger: {
    key: "challenger", Many: "Challengers", many: "Challengers", one: "Challenger", tier: "CHALLENGER",
    eyebrow: "Rumo ao Challenger", goalName: "Challenger", goalSub: "o objetivo", level: "Nível Challenger", levelOf: "no nível Challenger",
    coach: "Coach Challenger", refsWord: "Challengers de referência", gapTo: "do Challenger", theme: "chal-theme", radar: "Challenger",
  },
  briar: {
    key: "briar", Many: "Mono Briar", many: "mono Briar", one: "mono Briar", tier: "MASTER",
    eyebrow: "Os melhores Briar do mundo", goalName: "Mono Briar", goalSub: "os melhores do mundo", level: "Nível mono Briar", levelOf: "no nível dos mono Briar",
    coach: "Coach mono Briar", refsWord: "mono Briar de referência", gapTo: "dos mono Briar", theme: "chal-theme master-theme", radar: "Mono Briar",
  },
};
let CUR = VARIANTS.challenger;
export function setVariant(key) { CUR = VARIANTS[key] || VARIANTS.challenger; return CUR; }
export const L = () => CUR;
