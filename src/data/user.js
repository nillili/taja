// user.js — 사용자등록 정보와 개인 최고기록을 localStorage에 보관.
// 별도 인증/DB 없음. 학교+이름이 "로그인"을 대체한다.

const USER_KEY = "typing.user.v1";
const BEST_KEY = "typing.best.v1";

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// 사용자: { school, name, createdAt }
export function getUser() {
  const u = readJSON(USER_KEY);
  if (u && u.school && u.name) return u;
  return null;
}

export function saveUser({ school, name }) {
  const user = {
    school: school.trim(),
    name: name.trim(),
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  return user;
}

export function clearUser() {
  localStorage.removeItem(USER_KEY);
}

// 나가기(로그아웃) 때 함께 부른다. 같은 PC의 다음 사람이 앞사람의
// 개인 최고기록을 물려받으면 "최고 기록 갱신" 뱃지가 의미를 잃는다.
export function clearBest() {
  localStorage.removeItem(BEST_KEY);
}

// 개인 최고기록: { wpm, acc, screen, step, mode, updatedAt }  (전체 통합 단일값)
export function getBest() {
  return readJSON(BEST_KEY);
}

// 이번 결과가 개인 최고(타수 기준)를 넘으면 저장하고 true 반환.
export function updateBestIfHigher(result) {
  const prev = getBest();
  if (prev && result.wpm <= prev.wpm) return false;
  const best = {
    wpm: result.wpm,
    acc: result.acc,
    screen: result.screen,
    step: result.step,
    mode: result.mode ?? null,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(BEST_KEY, JSON.stringify(best));
  return true;
}
