// Fisher-Yates 셔플 (편향 없는 무작위 순서). 원본 배열은 건드리지 않는다.
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
