# Match-3 퍼즐 게임 개발: 설계 철학, 알고리즘, 그리고 학습

> Puzzle & Dragons 스타일의 Match-3 퍼즐 게임을 Phaser 3로 구현하면서
> 적용한 게임 개발 철학과 핵심 알고리즘, 그리고 이 프로젝트로부터
> 학습할 수 있는 게임 개발의 전반적인 내용을 다룬다.

---

## 목차

1. [서론 — 왜 Match-3인가](#1-서론--왜-match-3인가)
2. [설계 철학](#2-설계-철학)
   - 2.1 데이터와 시각의 분리
   - 2.2 유한 상태 기계로 게임 흐름 제어
   - 2.3 Promise 기반 비동기 애니메이션 체이닝
   - 2.4 확장을 위해 열고, 수정에는 닫는다
   - 2.5 설정의 외부화
   - 2.6 위임 패턴과 단일 책임
3. [핵심 알고리즘](#3-핵심-알고리즘)
   - 3.1 초기 보드 생성 — Rejection Sampling
   - 3.2 매치 검출 — Run-Length Scan + Flood Fill
   - 3.3 중력 시스템 — Column Compaction
   - 3.4 캐스케이드 — 반복적 해결 루프
   - 3.5 드래그 스왑 — 논리 위치와 시각 위치의 분리
   - 3.6 클리어 모드 보드 생성 — 제약 만족 문제
   - 3.7 타이머 게이지 — 호(Arc) 렌더링
4. [게임 개발 학습 포인트](#4-게임-개발-학습-포인트)
   - 4.1 Scene 기반 생명주기 관리
   - 4.2 입력 추상화
   - 4.3 좌표계 변환
   - 4.4 깊이(Depth) 레이어링
   - 4.5 트윈 기반 애니메이션 시스템
   - 4.6 메모리 관리와 destroy 패턴
   - 4.7 UX 피드백 설계
   - 4.8 게임 모드 확장 설계
5. [결론](#5-결론)

---

## 1. 서론 — 왜 Match-3인가

Match-3 퍼즐 게임은 게임 개발 학습에 있어 이상적인 프로젝트다.
단순해 보이는 "3개를 맞추면 사라진다"는 규칙 안에, 게임 개발의
거의 모든 핵심 주제가 압축되어 있기 때문이다.

| 학습 주제 | Match-3에서의 구현 |
|-----------|-------------------|
| 자료구조 | 2차원 배열 기반 그리드 |
| 그래프 알고리즘 | Flood Fill을 통한 연결 요소 탐색 |
| 상태 기계 | 입력 → 판정 → 소멸 → 낙하 → 연쇄의 흐름 제어 |
| 비동기 프로그래밍 | 애니메이션 순차 실행과 병렬 실행 |
| 물리 시뮬레이션 | 중력에 의한 심볼 낙하 |
| 입력 처리 | 드래그 & 드롭, 터치 추상화 |
| UX/UI 설계 | 콤보 피드백, 타이머 게이지, 선택 효과 |
| 확장 가능한 설계 | 스프라이트 교체, 매치 규칙 변경, 게임 모드 추가 |

특히 Puzzle & Dragons 스타일은 일반적인 Match-3(인접한 두 심볼을 교환)보다
훨씬 복잡한 드래그 메커니즘을 갖는다. 심볼을 "집어 올려" 보드 위를 자유롭게
움직이면서 경로상의 심볼들과 실시간으로 스왑하고, 제한 시간 내에 최대한 많은
매치를 만들어야 한다. 이 메커니즘 하나만으로도 입력 처리, 실시간 렌더링,
시간 관리, 논리-시각 동기화 등 여러 난제를 동시에 다루게 된다.

---

## 2. 설계 철학

### 2.1 데이터와 시각의 분리 (Model-View Separation)

이 프로젝트에서 가장 근본적인 설계 원칙은
**게임 상태(data)와 화면 표현(visual)을 철저히 분리**하는 것이다.

```
Board 클래스 내부:

grid[][]   → 순수 데이터 (정수 타입 ID 또는 null)
nodes[][]  → 시각 객체 (SymbolNode 인스턴스)
```

`grid[r][c] = 3`이라는 데이터는 "해당 위치에 Light 타입 심볼이 있다"는 사실만
표현한다. 이 심볼이 화면에 어떻게 보이는지(원형, 색상, 글로우 효과)는 전적으로
`SymbolNode`가 담당한다.

**왜 이것이 중요한가?**

매치 판정을 예로 들어보자. `MatchFinder.findMatches()`는 `grid[][]`만 받는다.
SymbolNode가 뭔지, Phaser가 뭔지 전혀 모른다. 순수한 2차원 정수 배열에 대한
알고리즘일 뿐이다.

```javascript
// MatchFinder.js — 시각 레이어에 대한 의존성이 전혀 없다
static findMatches(grid, rows, cols) {
    const matched = Array.from({ length: rows }, () => Array(cols).fill(false));
    // ... 순수 데이터 연산만 수행
}
```

이 분리가 가져다주는 실질적 이점:

1. **테스트 용이성**: `MatchFinder`를 순수 함수처럼 단위 테스트할 수 있다.
   브라우저도, Phaser도, 렌더링도 필요 없다.
2. **알고리즘 교체 가능성**: 매치 규칙을 L자, T자, 십자 등으로 확장할 때
   `grid[][]`만 보는 새 알고리즘을 작성하면 된다.
3. **스프라이트 전환 용이성**: `SymbolNode.createVisual()`만 바꾸면
   원형 그래픽에서 스프라이트 기반으로 전환된다. 게임 로직은 한 줄도 안 바뀐다.
4. **디버깅 효율**: 매치가 안 되면 `grid[][]`를 콘솔에 찍어보면 끝이다.
   시각적 문제와 논리적 문제를 독립적으로 추적할 수 있다.

이것은 게임 개발에서 반복적으로 등장하는 원칙이다.
체스 게임이라면 `board[8][8]`과 말의 3D 모델이 분리되어야 하고,
타워 디펜스라면 적의 경로 데이터와 적 캐릭터의 스프라이트가 분리되어야 한다.

---

### 2.2 유한 상태 기계로 게임 흐름 제어 (Finite State Machine)

Match-3 게임의 한 턴은 복잡한 단계로 이루어진다:

```
대기 → 드래그 → 매치 판정 → 콤보 소멸 → 낙하 → (연쇄 확인) → 대기
```

이 흐름을 if-else 플래그 조합으로 관리하면 금방 파국을 맞는다.
"드래그 중에 매치 판정이 시작되면?" "낙하 중에 사용자가 다시 드래그하면?"
같은 비정상 경로가 기하급수적으로 늘어나기 때문이다.

**유한 상태 기계(FSM)**는 이 문제를 구조적으로 해결한다.

```javascript
const State = Object.freeze({
    IDLE:       'idle',
    DRAGGING:   'dragging',
    RESOLVING:  'resolving',
    FALLING:    'falling',
    CLEAR_WIN:  'clear_win',
});
```

현재 상태를 하나의 변수(`this.state`)로 관리하고,
상태 전이를 명시적으로 제어한다:

```
IDLE ──(pointerdown)──→ DRAGGING
DRAGGING ──(pointerup/timeout)──→ RESOLVING
RESOLVING ──(gravity needed)──→ FALLING
FALLING ──(fall complete)──→ RESOLVING
RESOLVING ──(no more matches)──→ IDLE
RESOLVING ──(board clear)──→ CLEAR_WIN
```

핵심은 **게이트 함수**다:

```javascript
canStartDrag() {
    return this.state === State.IDLE;
}
```

이 한 줄이 "낙하 중 드래그", "판정 중 드래그" 같은 모든 비정상 입력을
근본적으로 차단한다. 상태가 `IDLE`이 아니면 입력 자체가 무시된다.

**FSM이 게임 개발에서 편재하는 이유:**

거의 모든 게임 엔티티는 FSM으로 모델링된다.
- 캐릭터: Idle → Walk → Jump → Fall → Land
- 적 AI: Patrol → Chase → Attack → Retreat
- UI: Hidden → Appearing → Visible → Disappearing

FSM을 일찍 도입하면 "이 상태에서는 이것만 가능하다"라는 규칙을
코드 구조로 강제할 수 있고, 그만큼 버그가 줄어든다.

---

### 2.3 Promise 기반 비동기 애니메이션 체이닝

게임에서 애니메이션은 **시간의 흐름** 위에 동작한다.
"심볼이 사라지고, 그 다음에 위의 심볼이 떨어지고, 그 다음에 연쇄 확인"
같은 순서를 보장해야 한다.

전통적인 게임 개발에서는 이를 콜백 지옥이나 타이머 체인으로 처리했다.
이 프로젝트는 **모든 애니메이션을 Promise로 래핑**하여
`async/await`으로 자연스럽게 순서를 표현한다.

```javascript
// SymbolNode.js — 애니메이션이 끝나면 Promise가 resolve된다
animateMatch() {
    return new Promise(resolve => {
        this.scene.tweens.add({
            targets: this.container,
            scaleX: 1.3, scaleY: 1.3,
            duration: CONFIG.ANIM.MATCH_FLASH_MS,
            yoyo: true,
            onComplete: () => {
                this.scene.tweens.add({
                    targets: this.container,
                    scaleX: 0, scaleY: 0, alpha: 0,
                    duration: CONFIG.ANIM.MATCH_DISAPPEAR_MS,
                    onComplete: resolve,  // ← 여기서 Promise 해소
                });
            },
        });
    });
}
```

이 패턴 덕분에 `resolveMatches()`의 코드는 마치 동기 코드처럼 읽힌다:

```javascript
async resolveMatches(groups, comboStart = 0) {
    let combo = comboStart;

    for (const group of groups) {
        combo++;
        this._showComboPopup(combo, group);

        // 이 그룹의 모든 심볼 소멸 애니메이션이 끝날 때까지 대기
        const anims = group.cells.map(({ row, col }) =>
            this.nodes[row][col].animateMatch());
        await Promise.all(anims);

        // 데이터 정리
        for (const { row, col } of group.cells) { /* ... */ }

        // 다음 콤보 전 짧은 대기
        await this._delay(CONFIG.ANIM.COMBO_PAUSE_MS);
    }
    return combo;
}
```

**병렬과 순차의 조합:**

- `Promise.all(anims)`: 한 매치 그룹 내의 심볼들은 **동시에** 사라진다.
- `for` 루프의 `await`: 매치 그룹 간에는 **순차적으로** 처리된다.
- `_resolveLoop`의 `while(true)`: 매치→소멸→낙하→재매치가 **반복**된다.

이 세 가지 제어 흐름을 `Promise.all` + `for-await` + `while`만으로
깔끔하게 표현할 수 있다는 것이 Promise 기반 설계의 가치다.

**콜백 기반이었다면:**

```javascript
// 이런 코드가 되었을 것이다 — "콜백 지옥"
animateGroup(groups, 0, () => {
    applyGravity(() => {
        findMatches((newGroups) => {
            if (newGroups.length > 0) {
                animateGroup(newGroups, combo, () => {
                    applyGravity(() => { /* ... 무한 중첩 ... */ });
                });
            }
        });
    });
});
```

async/await 패턴은 특히 게임의 컷신, 턴 시스템, UI 전환 등
"순서가 있는 비동기 흐름"이 필요한 모든 곳에서 강력하다.

---

### 2.4 확장을 위해 열고, 수정에는 닫는다 (Open-Closed Principle)

이 프로젝트에서 확장성은 "미래에 바꿀 수 있다"가 아니라
**"기존 코드를 건드리지 않고 새 기능을 추가할 수 있다"**를 의미한다.

세 가지 주요 확장점이 이 원칙을 보여준다:

#### (a) 시각 표현 교체 — `createVisual()` 오버라이드

```javascript
// SymbolNode.js
createVisual(typeId) {
    // 현재: Graphics API로 원형 그리기
    // 미래: 이 메서드를 오버라이드하여 Sprite 반환
}
```

`SymbolNode`를 상속한 `SpriteSymbolNode`를 만들고
`createVisual()`만 오버라이드하면 된다.
선택 효과, 애니메이션, 위치 관리 등 나머지 코드는 그대로 동작한다.
`Board`에서 `SymbolNode` 대신 `SpriteSymbolNode`를 생성하도록
한 줄만 바꾸면 전체 게임의 비주얼이 교체된다.

#### (b) 매치 규칙 교체 — `MatchFinder` 교체

```javascript
// 현재 호출:
MatchFinder.findMatches(this.grid, this.rows, this.cols)

// 확장: 새 매치 파인더 클래스로 교체
AdvancedMatchFinder.findMatches(this.grid, this.rows, this.cols)
```

반환 형식만 `Array<{ type, cells[] }>`를 지키면
L자 매치, 십자 매치, 4개 이상 특수 매치 등 어떤 규칙이든 적용 가능하다.
`Board`의 `resolveMatches()`는 "그룹 목록을 순회하며 소멸시키기"만 하므로
매치 규칙이 바뀌어도 소멸 로직은 전혀 수정할 필요가 없다.

#### (c) 게임 모드 추가 — Scene 데이터 기반 분기

```javascript
// MenuScene.js에서:
this.scene.start('GameScene', { mode: 'clear' });

// GameScene.js에서:
init(data) {
    this.mode = (data && data.mode) || 'demo';
}
```

새 모드를 추가하려면:
1. `MenuScene`에 카드 하나 추가
2. `Board`에 해당 모드의 초기화 로직 추가
3. `GameScene`에 해당 모드의 승리 조건 추가

기존 demo 모드의 코드는 건드리지 않는다.

---

### 2.5 설정의 외부화 (Configuration Object Pattern)

게임 개발에서 "매직 넘버"는 치명적이다.
`duration: 250`이 코드 곳곳에 흩어져 있으면,
"소멸 애니메이션을 좀 더 느리게"라는 요구에 수십 개 파일을 뒤져야 한다.

이 프로젝트는 **모든 조절 가능한 값을 `config.js` 한 파일로 집중**시켰다:

```javascript
export const CONFIG = {
    BOARD: { ROWS: 5, COLS: 6, CELL_SIZE: 82, ... },
    SYMBOLS: [ { id: 0, color: 0xE84545, stroke: 0xB33636, name: 'Fire' }, ... ],
    ORB: { RADIUS: 34, SELECTED_SCALE: 1.12 },
    DRAG: { TIMEOUT_MS: 5000, GAUGE_RADIUS: 42, ... },
    ANIM: { SWAP_MS: 80, MATCH_FLASH_MS: 120, ... },
};
```

**이것이 가져다주는 가치:**

- **밸런싱이 쉽다**: 드래그 시간을 3초로 줄이고 싶으면 `TIMEOUT_MS: 3000`
  한 줄이면 된다.
- **기획자 협업**: 프로그래머가 아닌 팀원도 이 파일의 숫자를 바꿔가며
  게임 느낌을 조절할 수 있다.
- **A/B 테스트**: 설정값을 런타임에 서버에서 받아올 수도 있다.
- **심볼 추가**: `SYMBOLS` 배열에 새 객체를 추가하면 즉시 게임에 반영된다.
  다른 코드는 `CONFIG.SYMBOLS.length`를 참조하므로 자동 대응된다.

---

### 2.6 위임 패턴과 단일 책임 (Delegation & Single Responsibility)

각 클래스는 **하나의 관심사**만 담당하고, 나머지는 위임한다:

```
GameScene (오케스트레이션)
  ├── Board (보드 상태 + 시각 관리)
  │     ├── SymbolNode[] (개별 심볼 시각화)
  │     └── MatchFinder (매치 검출 알고리즘)
  └── DragController (입력 처리 + 게이지 렌더링)
```

`DragController`는 매치가 뭔지 모른다. 그저 "드래그가 끝났다"고 Scene에 알린다.
`Board`는 사용자 입력이 뭔지 모른다. 그저 "이 셀과 저 셀을 스왑하라"는 명령을 받는다.
`MatchFinder`는 Phaser가 뭔지 모른다. 그저 2차원 배열을 받아 결과를 돌려준다.

이런 분리가 없으면 하나의 거대한 파일에 모든 로직이 뒤섞이게 되고,
기능 하나를 수정할 때 예상치 못한 사이드 이펙트가 발생한다.

---

## 3. 핵심 알고리즘

### 3.1 초기 보드 생성 — Rejection Sampling

게임이 시작될 때 보드에 이미 매치가 존재하면 안 된다.
플레이어가 아무것도 하지 않았는데 콤보가 터지면 혼란스럽기 때문이다.

**알고리즘:** 좌상단에서 우하단으로 한 칸씩 심볼을 배치한다.
각 칸에 랜덤 타입을 생성하되, 그 타입이 매치를 만들면 **거부(reject)**하고
다시 뽑는다.

```javascript
_initGrid() {
    for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
            let typeId;
            do {
                typeId = Phaser.Math.Between(0, numTypes - 1);
            } while (this._wouldMatch(r, c, typeId));
            this.grid[r][c] = typeId;
        }
    }
}
```

**`_wouldMatch` 검사:**

```javascript
_wouldMatch(row, col, typeId) {
    // 왼쪽 2칸이 같은 타입인가?
    if (col >= 2 &&
        this.grid[row][col - 1] === typeId &&
        this.grid[row][col - 2] === typeId) return true;
    // 위쪽 2칸이 같은 타입인가?
    if (row >= 2 &&
        this.grid[row - 1][col] === typeId &&
        this.grid[row - 2][col] === typeId) return true;
    return false;
}
```

**이 검사가 유효한 이유:**
좌상단에서 우하단으로 순서대로 채우므로, 현재 칸의 왼쪽과 위쪽만 확인하면 된다.
오른쪽과 아래쪽은 아직 비어 있으므로 매치가 성립하지 않는다.

**시간 복잡도:** 최악의 경우 O(rows × cols × retries)이지만,
6종의 심볼에서 매치를 만들 확률은 1/36이므로 실제로 retry는 거의 발생하지 않는다.

이 기법을 **Rejection Sampling**이라 한다.
조건을 만족할 때까지 랜덤 샘플을 반복하는 단순하지만 강력한 기법이다.

---

### 3.2 매치 검출 — Run-Length Scan + Flood Fill

매치 검출은 두 단계로 구성된다.

#### Phase 1: Run-Length Scan (마킹)

각 행을 좌에서 우로, 각 열을 위에서 아래로 스캔하며
**같은 타입이 3개 이상 연속되는 구간**을 찾아 `matched[][]`에 마킹한다.

```
보드 상태:         matched 결과:
🔴🔴🔴🔵🟢🟢      ✓ ✓ ✓ · · ·
🔵🟡🔵🔵🟢🟢      · · · · · ·
🟡🟡🟡🟡🟢🔴      ✓ ✓ ✓ ✓ ✓ ·
🔵🟢🔴🔵🟢🔴      · · · · · ·
🟡🟢🔴🟡🔵🔴      · · · · · ·
                   (세로 매치: 🟢 3열, 🔴 5열)
```

핵심은 `end` 포인터를 이용한 **연속 구간(run) 추적**이다:

```javascript
let c = 0;
while (c < cols) {
    const t = grid[r][c];
    if (t === null) { c++; continue; }
    let end = c;
    while (end + 1 < cols && grid[r][end + 1] === t) end++;
    if (end - c >= 2) {
        for (let i = c; i <= end; i++) matched[r][i] = true;
    }
    c = end + 1;
}
```

이 방식은 한 행을 O(cols)에 처리한다.
`end`가 진행한 만큼 `c`가 점프하므로 각 셀을 정확히 한 번만 방문한다.

#### Phase 2: Flood Fill (그룹핑)

마킹된 셀 중 **같은 타입이면서 상하좌우로 인접한 셀들을 하나의 그룹**으로 묶는다.

```
matched에서 마킹된 셀:          그룹핑 결과:
✓ ✓ ✓ · · ·                   [Group A: 🔴 (0,0)(0,1)(0,2)]
· · · · · ·                   [Group B: 🟡 (2,0)(2,1)(2,2)(2,3)]
✓ ✓ ✓ ✓ ✓ ·                   [Group C: 🟢 (2,4) + 세로 🟢셀들]
```

**왜 Flood Fill이 필요한가?**

L자, T자, 십자 형태의 매치가 있을 수 있기 때문이다.
예를 들어 가로 3개와 세로 3개가 한 셀을 공유하면,
이것은 **하나의 매치 그룹(1 combo)**이지 두 개가 아니다.
Run-Length Scan만으로는 이 병합을 처리할 수 없다.

```javascript
static _flood(grid, matched, visited, r, c, type, rows, cols, cells) {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;      // 경계 검사
    if (visited[r][c] || !matched[r][c] || grid[r][c] !== type) return;  // 조건 검사

    visited[r][c] = true;
    cells.push({ row: r, col: c });

    // 상하좌우 재귀 탐색
    _flood(..., r - 1, c, ...);
    _flood(..., r + 1, c, ...);
    _flood(..., r, c - 1, ...);
    _flood(..., r, c + 1, ...);
}
```

이것은 그래프 이론의 **연결 요소(Connected Component)** 탐색과 동일하다.
`matched && 같은 타입`인 셀들이 노드이고, 상하좌우 인접이 간선이다.

**전체 시간 복잡도:** O(rows × cols) — 각 셀을 최대 두 번 방문한다
(Phase 1에서 한 번, Phase 2에서 한 번).

---

### 3.3 중력 시스템 — Column Compaction

매치된 심볼이 사라지면 빈 공간이 생기고,
위에 있는 심볼들이 "떨어져야" 한다.

이 프로젝트는 **열(column) 단위 압축(compaction)** 알고리즘을 사용한다:

```
처리 전 (X = 빈 칸):     처리 후:
🔴  →  낙하 없음          🔴 (제자리)
 X                        🟡 (row 2 → row 1로 낙하)
🟡  →  한 칸 아래로         X  ← demo: 새 심볼 / clear: 빈 칸
 X
🔵  →  두 칸 아래로        🔵 (row 4, 제자리)
```

**알고리즘 단계:**

```
각 열(column)에 대해:
  1. 아래에서 위로 스캔하며 non-null 심볼을 수집
  2. 열 전체를 null로 초기화
  3. 수집한 심볼을 아래에서부터 다시 배치
  4. 남은 빈 칸에 새 심볼 생성 (demo 모드만)
```

구체적으로:

```javascript
// 1. 아래→위로 살아남은 심볼 수집
const existing = [];
for (let r = this.rows - 1; r >= 0; r--) {
    if (this.grid[r][c] !== null) {
        existing.push({ typeId, node, fromRow: r });
    }
}
// existing[0] = 가장 아래 심볼, existing[last] = 가장 위 심볼

// 2-3. 아래에서부터 재배치
for (let i = 0; i < existing.length; i++) {
    const targetRow = this.rows - 1 - i;  // 바닥부터 채움
    // existing[i]를 targetRow로 이동 + 애니메이션
}
```

**왜 아래→위로 수집하는가?**

상대적 순서를 유지하기 위해서다. 아래쪽 심볼이 배열 앞에 오고,
바닥(`rows-1`)부터 역순으로 배치하면 원래 위아래 관계가 보존된다.

**낙하 애니메이션:**

각 심볼의 낙하 거리에 비례하는 duration을 적용하고,
`Bounce.easeOut` 이징으로 바닥에 닿을 때 자연스러운 탄성을 표현한다:

```javascript
const dist = targetRow - fromRow;
node.animateFallTo(pos.x, pos.y, CONFIG.ANIM.FALL_MS_PER_CELL * (dist + 1));
```

---

### 3.4 캐스케이드 — 반복적 해결 루프 (Iterative Resolution)

"Skyfall 콤보"라고도 불리는 **캐스케이드**는 Match-3 게임의 쾌감의 핵심이다.
새로 떨어진 심볼이 우연히 매치를 만들면 추가 콤보가 발생하고,
그 콤보로 인해 또 떨어진 심볼이 또 매치를 만들 수 있다.

이 프로젝트는 이를 **단순한 while 루프**로 처리한다:

```javascript
async _resolveLoop() {
    while (true) {
        const groups = this.board.findMatches();
        if (groups.length === 0) break;    // 더 이상 매치 없으면 종료

        this.totalCombo = await this.board.resolveMatches(groups, this.totalCombo);
        await this.board.applyGravity();
        await this._delay(150);            // 사용자가 인지할 수 있는 짧은 대기
    }
}
```

**이 루프가 무한히 돌지 않는 이유:**

1. 매치가 발생하면 심볼이 **제거**된다 (보드의 심볼 수가 감소).
2. Demo 모드: 새 심볼이 랜덤으로 채워지지만,
   랜덤 6종 심볼이 연속 3개 매치를 만들 확률은 약 2.8%이므로
   연쇄가 영원히 지속되는 것은 확률적으로 불가능에 가깝다.
3. Clear 모드: 새 심볼이 생성되지 않으므로 심볼 수가 단조 감소한다.

**콤보 카운터의 연속성:**

`resolveMatches(groups, comboStart)`의 두 번째 인자가 핵심이다.
첫 번째 사이클에서 3콤보가 나오면 `comboStart = 3`이 반환되고,
다음 캐스케이드 사이클에서 `comboStart = 3`부터 시작하여 4콤보, 5콤보로 이어진다.

---

### 3.5 드래그 스왑 — 논리 위치와 시각 위치의 분리

Puzzle & Dragons의 드래그 메커니즘에는 미묘한 이중성이 있다.
드래그 중인 심볼은 **시각적으로는 커서를 따라가지만**,
**논리적으로는 그리드의 한 칸에 소속**되어 있어야 한다.

```
시각적 위치: 커서의 pixel 좌표 (자유로운 실수값)
논리적 위치: grid[dragRow][dragCol] (정수 인덱스)
```

**스왑이 발생하는 순간:**

커서가 새로운 셀 영역에 진입했을 때, 그 셀의 심볼과 스왑한다.

```javascript
_onMove(pointer) {
    // 1. 드래그 중인 심볼의 시각적 위치를 커서에 맞춤
    node.setPosition(pointer.x, pointer.y);

    // 2. 커서가 어느 셀 위에 있는지 계산
    const cell = this.board.getCellFromPoint(pointer.x, pointer.y);

    // 3. 현재 논리 위치와 다른 셀이면 스왑
    if (cell && (cell.row !== this.dragRow || cell.col !== this.dragCol)) {
        this.board.swapDuringDrag(this.dragRow, this.dragCol, cell.row, cell.col);
        this.dragRow = cell.row;
        this.dragCol = cell.col;
    }
}
```

**`swapDuringDrag` 내부:**

```javascript
swapDuringDrag(fromR, fromC, toR, toC) {
    // 데이터 교환 (destructuring swap)
    [this.grid[fromR][fromC], this.grid[toR][toC]] =
        [this.grid[toR][toC], this.grid[fromR][fromC]];
    [this.nodes[fromR][fromC], this.nodes[toR][toC]] =
        [this.nodes[toR][toC], this.nodes[fromR][fromC]];

    // 밀려난 심볼만 애니메이션 (드래그 중인 심볼은 커서를 따라가므로 무시)
    const displaced = this.nodes[fromR][fromC];
    const pos = this.getCellCenter(fromR, fromC);
    scene.tweens.add({ targets: displaced.container, x: pos.x, y: pos.y, ... });
}
```

**핵심 통찰:**

스왑 후 `grid`와 `nodes` 배열은 즉시 갱신되지만,
드래그 중인 심볼의 시각적 위치는 여전히 커서를 따라간다.
이 "데이터는 셀에, 그림은 커서에"라는 이중 상태가
PaD 스타일 드래그의 본질이다.

밀려난 심볼은 80ms 트윈으로 부드럽게 이전 위치로 미끄러지며,
이것이 사용자에게 "심볼이 밀려나는" 느낌을 준다.

---

### 3.6 클리어 모드 보드 생성 — 제약 만족 문제 (CSP)

클리어 모드의 보드는 두 가지 제약을 동시에 만족해야 한다:

1. **각 심볼 타입의 개수가 3의 배수** (전부 매치로 제거 가능)
2. **초기 매치가 없음** (게임 시작 전에 콤보가 터지면 안 됨)

이것은 일종의 **제약 만족 문제(Constraint Satisfaction Problem, CSP)**이다.

#### 단계 1: 분배 생성

```javascript
_generateClearCounts() {
    const counts = new Array(6).fill(3);  // 6종 × 3개 = 18
    let remaining = 30 - 18;              // 12개 남음

    while (remaining > 0) {
        const t = Phaser.Math.Between(0, 5);
        counts[t] += 3;                  // 랜덤 타입에 3개씩 추가
        remaining -= 3;
    }
    return counts;  // 예: [6, 3, 6, 6, 6, 3] (합 = 30, 모두 3의 배수)
}
```

6×5 = 30칸, 6종 심볼이므로 기본 3개씩 18개를 배정하고,
남은 12개를 3개 단위로 랜덤 분배한다 (4회 반복).

#### 단계 2: 탐욕적 배치 (Greedy Placement)

남은 예산(budget)에서 매치를 만들지 않는 타입만 골라 배치한다:

```javascript
for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
        const valid = [];
        for (let t = 0; t < remaining.length; t++) {
            if (remaining[t] > 0 && !this._wouldMatch(r, c, t)) {
                valid.push(t);
            }
        }
        typeId = valid[randomIndex];
        remaining[typeId]--;
    }
}
```

**이 탐욕적 접근이 거의 항상 성공하는 이유:**

- 6종의 심볼에서 매치 금지 조건은 최대 2개 타입을 제외한다
  (왼쪽 2칸이 같은 타입, 위쪽 2칸이 같은 타입).
- 따라서 `valid` 배열에는 거의 항상 4종 이상이 남는다.
- 예산이 남아 있는 한 선택지가 고갈될 확률은 극히 낮다.

만약 실패할 경우를 대비한 fallback도 있다
(`remaining.findIndex(n => n > 0)`로 매치를 감수하고 배치).

---

### 3.7 타이머 게이지 — 호(Arc) 렌더링

드래그 제한 시간을 시각적으로 보여주는 원형 게이지는
**매 프레임 Graphics를 clear하고 다시 그리는** 방식으로 구현된다.

```javascript
_drawGauge(fraction) {
    this.gaugeGfx.clear();  // 이전 프레임의 그래픽 제거

    // 배경 링 (완전한 원)
    this.gaugeGfx.lineStyle(thickness, 0x000000, 0.3);
    this.gaugeGfx.beginPath();
    this.gaugeGfx.arc(x, y, r, 0, Math.PI * 2, false);
    this.gaugeGfx.strokePath();

    // 전경 호 (남은 시간에 비례)
    const startAngle = -Math.PI / 2;                   // 12시 방향
    const endAngle = startAngle + fraction * Math.PI * 2;  // 시계 방향으로 감소

    this.gaugeGfx.lineStyle(thickness + 1, color, 0.9);
    this.gaugeGfx.beginPath();
    this.gaugeGfx.arc(x, y, r, startAngle, endAngle, false);
    this.gaugeGfx.strokePath();
}
```

**핵심 수학:**

- `fraction = remaining / total` → 1.0(가득) ~ 0.0(소진)
- 시작 각도: `-π/2` (12시 방향, 캔버스에서 위쪽은 -y)
- 끝 각도: `-π/2 + fraction × 2π`
- fraction이 1.0이면 완전한 원, 0.5이면 반원, 0.0이면 점

**색상 전이:**

```javascript
_gaugeColor(fraction) {
    if (fraction > 0.6) return 0x00FF88;   // 초록 (여유)
    if (fraction > 0.3) return 0xFFDD00;   // 노랑 (주의)
    return 0xFF3333;                        // 빨강 (긴급)
}
```

3단계 이산 전이를 사용했다. 부드러운 보간(interpolation)도 가능하지만,
게이지의 목적은 "지금 얼마나 급한지"를 즉시 인지시키는 것이므로
명확한 색상 변화가 더 효과적이다.

---

## 4. 게임 개발 학습 포인트

### 4.1 Scene 기반 생명주기 관리

Phaser 3의 Scene은 게임의 **화면 단위 생명주기**를 관리하는 컨테이너다.

```
Scene 생명주기:
  init(data)   → 데이터 초기화 (모드, 점수 등)
  preload()    → 리소스 로딩
  create()     → 게임 오브젝트 생성
  update(t, dt)→ 매 프레임 실행
```

**Scene 전환의 핵심 패턴:**

```javascript
// 데이터를 넘기며 Scene 전환
this.scene.start('GameScene', { mode: 'clear' });

// 받는 쪽에서 init()으로 수신
init(data) {
    this.mode = data.mode;
}
```

`scene.start()`는 현재 Scene을 정지/파괴하고 새 Scene을 시작한다.
이 때 이전 Scene의 모든 게임 오브젝트, 이벤트 리스너, 트윈이
자동으로 정리된다. 이것이 Scene을 사용해야 하는 가장 큰 이유다 —
**메모리 누수 없는 화면 전환**.

---

### 4.2 입력 추상화 (Input Abstraction)

이 프로젝트의 입력 처리는 의도적으로 **마우스/터치 무관하게 설계**되었다.

```javascript
this.scene.input.on('pointerdown', this._onDown, this);
this.scene.input.on('pointermove', this._onMove, this);
this.scene.input.on('pointerup', this._onUp, this);
```

Phaser의 `pointer` 이벤트는 마우스 클릭과 터치를 동일하게 추상화한다.
`pointer.x`, `pointer.y`는 마우스든 손가락이든 같은 좌표를 제공한다.

**이 추상화를 깨뜨리지 않기 위한 주의사항:**

- `mousedown`/`mouseup` 대신 반드시 `pointerdown`/`pointerup` 사용
- CSS에서 `touch-action: none`으로 브라우저 기본 터치 동작(스크롤, 줌) 차단
- `-webkit-user-select: none`으로 텍스트 선택 방지

```html
<style>
    #game-container {
        touch-action: none;
        -webkit-touch-callout: none;
        user-select: none;
    }
</style>
```

---

### 4.3 좌표계 변환 (Coordinate Transformation)

게임에서 좌표계 변환은 끊임없이 발생한다.
이 프로젝트에는 세 가지 좌표 공간이 공존한다:

```
1. 그리드 좌표: (row, col) — 정수, 0-indexed
2. 월드 좌표: (x, y) — 픽셀 단위의 실수값
3. 화면 좌표: pointer.x, pointer.y — 사용자 입력
```

변환 함수 두 개가 이 세 공간을 연결한다:

```javascript
// 그리드 → 월드 (셀 중심의 픽셀 좌표)
getCellCenter(row, col) {
    return {
        x: this.originX + col * this.cellSize + this.cellSize / 2,
        y: this.originY + row * this.cellSize + this.cellSize / 2,
    };
}

// 월드/화면 → 그리드 (어느 셀에 해당하는지)
getCellFromPoint(px, py) {
    const col = Math.floor((px - this.originX) / this.cellSize);
    const row = Math.floor((py - this.originY) / this.cellSize);
    if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
        return { row, col };
    }
    return null;  // 보드 밖
}
```

`getCellFromPoint`에서 `Math.floor`를 사용하는 이유:
셀의 왼쪽 상단부터 오른쪽 하단까지 전체 영역이 해당 셀로 매핑되어야 하기 때문이다.
`Math.round`를 사용하면 셀 경계 부근에서 의도치 않은 셀이 선택된다.

Phaser의 FIT 스케일 모드에서는 화면 좌표와 월드 좌표가 자동으로 매핑되므로,
입력 좌표(pointer.x/y)를 직접 `getCellFromPoint`에 넘길 수 있다.
다른 프레임워크에서는 이 매핑을 수동으로 처리해야 할 수 있다.

---

### 4.4 깊이(Depth) 레이어링

2D 게임에서 "무엇이 무엇 위에 그려지는가"는 `depth` 값으로 제어한다.

이 프로젝트의 레이어 맵:

```
depth -1:    보드 배경 (그리드 셀)
depth  0:    일반 심볼 (SymbolNode 기본값)
depth 1000:  드래그 중인 심볼 (다른 모든 심볼 위에 표시)
depth 2000:  콤보 팝업 텍스트
depth 2001:  타이머 게이지 (드래그 심볼 앞에 표시)
depth 3000:  승리 오버레이 (어두운 배경)
depth 3001:  승리 텍스트 + 버튼
depth 3002:  버튼 히트 영역 (최상위)
```

**설계 원칙:**

- 기능적으로 독립된 레이어 간에 큰 간격을 둔다 (0, 1000, 2000, 3000).
- 같은 레이어 내에서의 미세 조정은 +1 단위로 한다 (3000, 3001, 3002).
- 드래그 심볼의 depth는 `select()` 시 동적으로 설정하고,
  `deselect()` 시 원래 값(0)으로 복원한다.

이 계층은 간단해 보이지만, 레이어 관리를 소홀히 하면
"콤보 텍스트가 게이지 뒤에 가려진다"거나
"드래그 심볼이 다른 심볼 아래로 들어간다"같은
디버깅하기 어려운 시각적 버그가 발생한다.

---

### 4.5 트윈(Tween) 기반 애니메이션 시스템

이 게임의 모든 움직임은 **트윈(tween)**으로 구현된다.
트윈은 "시작값에서 끝값으로 일정 시간에 걸쳐 보간한다"는 개념이다.

각 애니메이션의 이징(easing) 선택에는 의도가 있다:

| 애니메이션 | 이징 | 이유 |
|-----------|------|------|
| 드래그 스왑 | `Power2` | 빠르고 부드러운 이동. 즉각적 반응감. |
| 매치 플래시 | `Quad.easeOut` | 빠르게 커졌다가 원래로. 주의 환기. |
| 매치 소멸 | `Back.easeIn` | 빨려 들어가듯 사라짐. 소멸감 강조. |
| 중력 낙하 | `Bounce.easeOut` | 바닥에 튕기는 물리적 느낌. |
| 콤보 팝업 | `Back.easeOut` | 탄력적으로 튀어나옴. 성취감. |
| 메뉴 타이틀 | `Sine.easeInOut` | 부드러운 상하 부유. 안정감. |
| 콤보 페이드 | `Power2` | 자연스럽게 사라짐. 방해하지 않음. |

**이징 곡선의 직관적 이해:**

```
easeIn:  느리게 시작 → 빠르게 끝       (가속)
easeOut: 빠르게 시작 → 느리게 끝       (감속)
easeInOut: 느리게 → 빠르게 → 느리게   (가속 후 감속)

Back:    목표를 살짝 지나갔다 돌아옴    (탄성)
Bounce:  목표에서 여러 번 튕김         (물리적)
Sine:    삼각함수 곡선                 (부드러운 반복)
```

게임 개발에서 이징 선택은 "이 움직임이 물리적으로 어떤 성격인가?"를
자문하는 것으로 결정할 수 있다. 떨어지는 것은 Bounce, 빨려 들어가는 것은 Back,
반복되는 것은 Sine이 자연스럽다.

---

### 4.6 메모리 관리와 destroy 패턴

브라우저 기반 게임에서 메모리 누수는 성능 저하의 주범이다.
이 프로젝트는 세 가지 레벨에서 자원 정리를 수행한다:

#### (a) 개별 심볼 소멸

```javascript
// SymbolNode.destroy()
destroy() {
    if (this._glowTween) this._glowTween.stop();  // 진행 중인 트윈 정지
    this.container.destroy();                       // Phaser 오브젝트 제거
}
```

트윈을 정지하지 않으면, 이미 파괴된 컨테이너를 대상으로
트윈이 계속 업데이트를 시도하여 에러가 발생한다.

#### (b) 입력 리스너 해제

```javascript
// DragController.destroy()
destroy() {
    this.scene.input.off('pointerdown', this._onDown, this);
    this.scene.input.off('pointermove', this._onMove, this);
    this.scene.input.off('pointerup', this._onUp, this);
    this.gaugeGfx.destroy();
}
```

이벤트 리스너를 해제하지 않으면, Scene이 전환된 후에도
이전 Scene의 핸들러가 호출되어 "유령 이벤트"가 발생한다.

#### (c) Scene 자동 정리

Phaser의 `scene.start()`는 현재 Scene의 모든 게임 오브젝트를
자동으로 파괴한다. 이것이 Scene 시스템을 사용하는 가장 큰 이점이다.
수동 정리가 필요한 것은 Scene 외부에 등록된 리소스뿐이다.

---

### 4.7 UX 피드백 설계

게임에서 **피드백**은 "사용자의 행동에 대한 시각/청각적 응답"이다.
피드백이 없으면 사용자는 자신의 행동이 효과가 있는지 불안해한다.

이 프로젝트의 피드백 체계:

| 사용자 행동 | 시각적 피드백 |
|------------|-------------|
| 심볼 선택 | 1.12배 확대 + 글로우 링 + 펄싱 애니메이션 |
| 드래그 중 | 심볼이 커서를 따라감 + 타이머 게이지 |
| 셀 진입 (스왑) | 밀려난 심볼의 80ms 슬라이드 |
| 시간 경과 | 게이지 색상 전이 (초록→노랑→빨강) |
| 매치 발생 | 플래시(확대) → 수축 + 페이드 |
| 콤보 | 매치 중심에 숫자 팝업 (Back.easeOut) + 상단 카운터 |
| 낙하 | Bounce 이징의 물리적 느낌 |
| 보드 클리어 | 어두운 오버레이 + "BOARD CLEAR!" 팝인 + 결과 표시 |

**특히 중요한 설계 결정: 순차적 콤보 소멸**

매치 그룹을 한꺼번에 제거하지 않고 **하나씩 순서대로** 제거하는 것은
의도적인 UX 선택이다:

```javascript
for (const group of groups) {
    combo++;
    this._showComboPopup(combo, group);     // "1", "2", "3" 순차 표시
    await Promise.all(/* 이 그룹 소멸 */);
    await this._delay(CONFIG.ANIM.COMBO_PAUSE_MS);  // 200ms 대기
}
```

이 200ms의 간격이 사용자에게 주는 것:
1. **인지 시간**: 어떤 심볼이 사라졌는지 확인할 수 있다.
2. **성취감**: 콤보 숫자가 하나씩 올라가는 것을 볼 수 있다.
3. **학습**: 어떤 배치가 콤보를 만들었는지 역추적할 수 있다.

한꺼번에 사라지면 시각적으로는 화려하지만,
사용자는 "뭐가 어떻게 된 건지" 파악할 수 없다.

---

### 4.8 게임 모드 확장 설계

두 가지 모드(Demo, Clear)의 구현 방식은 향후 모드 추가의 청사진이다.

**모드 차이가 발생하는 세 지점:**

```
1. 보드 초기화:  Board constructor에서 mode에 따라 _initGrid() 또는 _initClearGrid()
2. 런타임 규칙:  applyGravity()에서 mode !== 'clear'일 때만 새 심볼 생성
3. 종료 조건:    GameScene.onDragEnd()에서 mode === 'clear' && board.isClear()
```

**새 모드를 추가한다면 (예: "타임 어택 모드"):**

1. `MenuScene`에 새 카드 추가
2. `Board`에 필요한 초기화 로직 추가 (또는 기존 것 재사용)
3. `GameScene`의 `init()`에서 모드별 설정 (제한 시간, 목표 콤보 수 등)
4. `GameScene`에 해당 모드의 종료/승리 조건 추가

기존 demo 모드와 clear 모드의 코드는 전혀 수정할 필요가 없다.
이것이 **모드를 문자열 키로 분기**하는 패턴의 장점이다.

---

## 5. 결론

540줄 미만의 핵심 로직으로 구성된 이 프로젝트는
작은 규모에 비해 놀라울 정도로 많은 게임 개발 개념을 포함하고 있다.

**설계 차원에서 배운 것:**

- 데이터와 시각의 분리는 모든 게임 아키텍처의 기초다.
- 유한 상태 기계는 복잡한 게임 흐름을 길들이는 가장 신뢰할 수 있는 도구다.
- Promise 기반 비동기 패턴은 애니메이션 순서 제어를 극적으로 단순화한다.
- 확장성은 "예측"이 아니라 "진입점(override point)을 남기는 것"이다.

**알고리즘 차원에서 배운 것:**

- Rejection Sampling은 제약 조건하 생성의 가장 단순한 해법이다.
- Run-Length Scan + Flood Fill 2단계 매치 검출은 O(n)으로 모든 패턴을 잡는다.
- Column Compaction 중력은 열 단위 독립 처리로 병렬 애니메이션이 가능하다.
- 반복적 해결 루프는 캐스케이드를 재귀 없이 처리하는 가장 깔끔한 방법이다.

**실전 차원에서 배운 것:**

- 이징 곡선 하나가 "떨어지는 느낌"과 "밀려나는 느낌"을 결정한다.
- 200ms의 의도적 지연이 사용자 경험을 근본적으로 바꾼다.
- depth 레이어링을 처음부터 체계적으로 관리하지 않으면 나중에 고통스럽다.
- 좌표 변환 함수 두 개(`getCellCenter`, `getCellFromPoint`)가
  전체 게임의 공간적 일관성을 보장한다.

Match-3 퍼즐은 게임 개발의 "Hello, World!"가 아니다.
오히려 상태 관리, 비동기 제어, 알고리즘 설계, UX 피드백이 한데 엮인
**소규모 종합 프로젝트**다. 이 프로젝트를 제대로 이해했다면,
턴제 RPG, 타워 디펜스, 카드 게임 등 유사한 구조의 게임으로
자연스럽게 확장할 수 있는 기반을 갖추게 된 것이다.
