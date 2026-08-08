/**
 * scroll-depth.ts — 스크롤 깊이 임계값 계산 (순수 함수)
 *
 * DOM에 의존하지 않아 단위 테스트가 쉽다. 실제 스크롤 이벤트 리스닝은
 * ScrollDepthTracker.tsx(클라이언트 컴포넌트)가 담당하고, 이 함수는
 * "현재 스크롤 비율 + 이미 전송한 임계값 목록"을 받아 "새로 전송해야 할
 * 임계값"만 계산한다.
 */

export type ScrollThreshold = 25 | 50 | 75 | 100;

const THRESHOLDS: ScrollThreshold[] = [25, 50, 75, 100];

export function getNewlyReachedThresholds(
  percent: number,
  alreadyFired: ReadonlySet<ScrollThreshold>
): ScrollThreshold[] {
  return THRESHOLDS.filter(
    (threshold) => percent >= threshold && !alreadyFired.has(threshold)
  );
}
