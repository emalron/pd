// ============================================================
// MatchFinder — detects matched groups on the board.
//
// EXTENSIBILITY:
//   To change match rules (e.g. L/T/cross shapes, 4+ bonuses),
//   subclass MatchFinder and override `findMatches`.
//   The returned format must stay: Array<{ type, cells[] }>.
// ============================================================

export class MatchFinder {
    /**
     * Scan the grid and return all matched groups.
     * Each group = { type: number, cells: [{row,col}, ...] }
     * Connected matched cells of the same type are merged into one group.
     *
     * @param {(number|null)[][]} grid  2-D array of type IDs (null = empty)
     * @param {number} rows
     * @param {number} cols
     * @returns {Array<{type: number, cells: Array<{row: number, col: number}>}>}
     */
    static findMatches(grid, rows, cols) {
        // Step 1 — mark every cell that belongs to a 3+ horizontal or vertical run
        const matched = Array.from({ length: rows }, () => Array(cols).fill(false));

        // Horizontal runs
        for (let r = 0; r < rows; r++) {
            let c = 0;
            while (c < cols) {
                const t = grid[r][c];
                if (t === null || t === undefined) { c++; continue; }
                let end = c;
                while (end + 1 < cols && grid[r][end + 1] === t) end++;
                if (end - c >= 2) {
                    for (let i = c; i <= end; i++) matched[r][i] = true;
                }
                c = end + 1;
            }
        }

        // Vertical runs
        for (let c = 0; c < cols; c++) {
            let r = 0;
            while (r < rows) {
                const t = grid[r][c];
                if (t === null || t === undefined) { r++; continue; }
                let end = r;
                while (end + 1 < rows && grid[end + 1][c] === t) end++;
                if (end - r >= 2) {
                    for (let i = r; i <= end; i++) matched[i][c] = true;
                }
                r = end + 1;
            }
        }

        // Step 2 — flood-fill to group adjacent matched cells of the same type
        const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
        const groups = [];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (matched[r][c] && !visited[r][c]) {
                    const type = grid[r][c];
                    const cells = [];
                    MatchFinder._flood(grid, matched, visited, r, c, type, rows, cols, cells);
                    groups.push({ type, cells });
                }
            }
        }

        return groups;
    }

    /** @private */
    static _flood(grid, matched, visited, r, c, type, rows, cols, cells) {
        if (r < 0 || r >= rows || c < 0 || c >= cols) return;
        if (visited[r][c] || !matched[r][c] || grid[r][c] !== type) return;

        visited[r][c] = true;
        cells.push({ row: r, col: c });

        MatchFinder._flood(grid, matched, visited, r - 1, c, type, rows, cols, cells);
        MatchFinder._flood(grid, matched, visited, r + 1, c, type, rows, cols, cells);
        MatchFinder._flood(grid, matched, visited, r, c - 1, type, rows, cols, cells);
        MatchFinder._flood(grid, matched, visited, r, c + 1, type, rows, cols, cells);
    }
}
