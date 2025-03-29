/**
 * 체스 UI 및 게임 로직을 연결하는 클래스
 * Stockfish 엔진 연동 버전
 */
class ChessGame {
    constructor() {
        // chess.js 인스턴스 생성
        this.chess = new Chess();
        this.selectedSquare = null;
        this.possibleMoves = [];
        
        // Stockfish 엔진 초기화 (5수 깊이)
        this.stockfishEngine = new StockfishEngine(5);
        this.stockfishEngine.onReady(() => {
            console.log('Stockfish 엔진이 준비되었습니다.');
        });
        
        // 말에 대한 유니코드 문자
        this.pieceSymbols = {
            'w': {
                'p': '♙',
                'n': '♘',
                'b': '♗',
                'r': '♖',
                'q': '♕',
                'k': '♔'
            },
            'b': {
                'p': '♟',
                'n': '♞',
                'b': '♝',
                'r': '♜',
                'q': '♛',
                'k': '♚'
            }
        };
        
        this.initializeBoard();
        this.bindEvents();
    }
    
    // 체스판 초기화
    initializeBoard() {
        const chessboard = document.getElementById('chessboard');
        chessboard.innerHTML = '';
        
        // 체스판 생성
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'white' : 'black'}`;
                // chess.js는 a1, e4 같은 좌표 형식을 사용
                const file = String.fromCharCode('a'.charCodeAt(0) + col);
                const rank = 8 - row;
                square.dataset.square = file + rank;
                
                // 말 배치
                const piece = this.chess.get(file + rank);
                if (piece) {
                    const pieceElement = document.createElement('div');
                    pieceElement.className = 'piece';
                    pieceElement.textContent = this.getPieceSymbol(piece);
                    square.appendChild(pieceElement);
                }
                
                chessboard.appendChild(square);
            }
        }
        
        this.updateStatus();
        this.updateMoveList();
    }
    
    // 이벤트 바인딩
    bindEvents() {
        const chessboard = document.getElementById('chessboard');
        
        // 체스판 전체에 이벤트 위임 설정
        chessboard.addEventListener('click', (event) => {
            this.handleSquareClick(event);
        });
        
        document.getElementById('new-game').addEventListener('click', this.newGame.bind(this));
        document.getElementById('ai-move').addEventListener('click', this.makeAIMove.bind(this));
        document.getElementById('undo-move').addEventListener('click', this.undoMove.bind(this));
        
        const promotionPieces = document.querySelectorAll('.promotion-piece');
        promotionPieces.forEach(piece => {
            piece.addEventListener('click', (e) => {
                const pieceType = e.target.dataset.piece;
                this.completePromotion(pieceType);
            });
        });
    }
    
    // 체스 말 기호 가져오기
    getPieceSymbol(piece) {
        return this.pieceSymbols[piece.color][piece.type];
    }
    
    // 사각형 클릭 이벤트 처리
    handleSquareClick(event) {
        // 프로모션 중이라면 클릭 무시
        if (document.getElementById('promotion-modal').style.display === 'block') return;
        
        // 클릭된 요소가 말(piece)인 경우 부모인 square를 찾음
        let square = event.target.closest('.square');
        if (!square) return;
        
        const squareName = square.dataset.square;
        console.log('Clicked square:', squareName);
        
        // 말이 선택되지 않았다면 말 선택
        if (!this.selectedSquare) {
            const piece = this.chess.get(squareName);
            // 자신의 차례에 맞는 말만 선택 가능
            if (piece && piece.color === (this.chess.turn() === 'w' ? 'w' : 'b')) {
                this.selectSquare(squareName);
            }
        } 
        // 이미 말이 선택된 경우 이동 또는 다른 말 선택
        else {
            // 같은 말을 다시 클릭하면 선택 취소
            if (this.selectedSquare === squareName) {
                this.clearSelection();
                return;
            }
            
            const targetPiece = this.chess.get(squareName);
            // 같은 색상의 다른 말 선택
            if (targetPiece && targetPiece.color === this.chess.turn()) {
                this.clearSelection();
                this.selectSquare(squareName);
                return;
            }
            
            // 이동 시도
            this.tryMove(this.selectedSquare, squareName);
        }
    }
    
    // 말 선택
    selectSquare(squareName) {
        this.selectedSquare = squareName;
        
        // 가능한 이동 계산
        this.possibleMoves = this.chess.moves({
            square: squareName,
            verbose: true
        });
        
        this.highlightSquares();
    }
    
    // 이동 시도
    tryMove(fromSquare, toSquare) {
        // 프로모션 확인
        const piece = this.chess.get(fromSquare);
        const isPawn = piece && piece.type === 'p';
        const isPromotionRank = toSquare.charAt(1) === '8' || toSquare.charAt(1) === '1';
        
        if (isPawn && isPromotionRank) {
            // 프로모션 대화상자 표시
            this.pendingMove = { from: fromSquare, to: toSquare };
            this.showPromotionDialog();
            return;
        }
        
        // 일반 이동
        try {
            const moveResult = this.chess.move({
                from: fromSquare,
                to: toSquare,
                promotion: 'q' // 기본값은 퀸
            });
            
            if (moveResult) {
                this.clearSelection();
                this.refreshBoard();
                this.updateStatus();
                this.updateMoveList();
                
                // 체크 상태 강조 표시
                this.highlightCheck();
            } else {
                this.clearSelection();
            }
        } catch (e) {
            console.error("Invalid move:", e);
            this.clearSelection();
        }
    }
    
    // 선택 해제
    clearSelection() {
        this.selectedSquare = null;
        this.possibleMoves = [];
        this.clearHighlights();
    }
    
    // 선택된 말과 가능한 이동 표시
    highlightSquares() {
        this.clearHighlights();
        
        // 선택된 말 강조
        const selectedSquareElement = document.querySelector(
            `.square[data-square="${this.selectedSquare}"]`
        );
        if (selectedSquareElement) {
            selectedSquareElement.classList.add('selected');
        }
        
        // 가능한 이동 강조
        for (const move of this.possibleMoves) {
            const square = document.querySelector(
                `.square[data-square="${move.to}"]`
            );
            if (square) {
                square.classList.add('possible-move');
            }
        }
    }
    
    // 강조 표시 제거
    clearHighlights() {
        document.querySelectorAll('.square').forEach(square => {
            square.classList.remove('selected', 'possible-move', 'highlight');
        });
    }
    
    // 승진 대화상자 표시
    showPromotionDialog() {
        const modal = document.getElementById('promotion-modal');
        const overlay = document.getElementById('modal-overlay');
        
        modal.style.display = 'block';
        overlay.style.display = 'block';
        
        // 현재 플레이어 색상에 맞는 프로모션 기물 표시
        const color = this.chess.turn();
        document.querySelectorAll('.promotion-piece').forEach(piece => {
            const pieceType = piece.dataset.piece;
            piece.textContent = this.pieceSymbols[color][pieceType];
        });
    }
    
    // 승진 완료
    completePromotion(pieceType) {
        const modal = document.getElementById('promotion-modal');
        const overlay = document.getElementById('modal-overlay');
        
        modal.style.display = 'none';
        overlay.style.display = 'none';
        
        if (!this.pendingMove) return;
        
        // 이동 실행
        try {
            const moveResult = this.chess.move({
                from: this.pendingMove.from,
                to: this.pendingMove.to,
                promotion: pieceType
            });
            
            if (moveResult) {
                this.clearSelection();
                this.refreshBoard();
                this.updateStatus();
                this.updateMoveList();
                
                // 체크 상태 강조 표시
                this.highlightCheck();
            }
        } catch (e) {
            console.error("Invalid promotion move:", e);
        }
        
        this.pendingMove = null;
    }
    
    // 체크 상태 강조 표시
    highlightCheck() {
        if (this.chess.in_check()) {
            const color = this.chess.turn();
            // 체스판에서 왕의 위치 찾기
            for (let row = 0; row < 8; row++) {
                for (let col = 0; col < 8; col++) {
                    const file = String.fromCharCode('a'.charCodeAt(0) + col);
                    const rank = 8 - row;
                    const squareName = file + rank;
                    const piece = this.chess.get(squareName);
                    
                    if (piece && piece.type === 'k' && piece.color === color) {
                        const kingSquare = document.querySelector(
                            `.square[data-square="${squareName}"]`
                        );
                        
                        if (kingSquare) {
                            kingSquare.classList.add('highlight');
                        }
                        return;
                    }
                }
            }
        }
    }
    
    // 상태 업데이트
    updateStatus() {
        const status = document.getElementById('status');
        
        if (this.chess.game_over()) {
            if (this.chess.in_checkmate()) {
                const winner = this.chess.turn() === 'w' ? "검은색" : "흰색";
                status.textContent = `체크메이트! ${winner} 승리`;
            } else if (this.chess.in_draw()) {
                if (this.chess.in_stalemate()) {
                    status.textContent = "스테일메이트! 무승부";
                } else if (this.chess.insufficient_material()) {
                    status.textContent = "부족한 재료에 의한 무승부";
                } else {
                    status.textContent = "무승부";
                }
            }
        } else {
            const turn = this.chess.turn() === 'w' ? "흰색" : "검은색";
            const check = this.chess.in_check() ? " (체크)" : "";
            status.textContent = `현재 상태: ${turn} 차례${check}`;
        }
    }
    
    // 기보 업데이트
    updateMoveList() {
        const moveList = document.getElementById('move-list');
        moveList.innerHTML = '';
        
        const history = this.chess.history({ verbose: true });
        
        for (let i = 0; i < history.length; i += 2) {
            const moveNumber = document.createElement('div');
            moveNumber.className = 'move-number';
            moveNumber.textContent = `${Math.floor(i / 2) + 1}.`;
            
            const whiteMove = document.createElement('div');
            whiteMove.textContent = history[i].san;
            
            const blackMove = document.createElement('div');
            if (i + 1 < history.length) {
                blackMove.textContent = history[i + 1].san;
            }
            
            moveList.appendChild(moveNumber);
            moveList.appendChild(whiteMove);
            moveList.appendChild(blackMove);
        }
    }
    
    // 보드 상태를 UI에 반영
    refreshBoard() {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const file = String.fromCharCode('a'.charCodeAt(0) + col);
                const rank = 8 - row;
                const squareName = file + rank;
                
                const square = document.querySelector(
                    `.square[data-square="${squareName}"]`
                );
                
                if (square) {
                    // 말 제거
                    while (square.firstChild) {
                        square.removeChild(square.firstChild);
                    }
                    
                    // 말 추가
                    const piece = this.chess.get(squareName);
                    if (piece) {
                        const pieceElement = document.createElement('div');
                        pieceElement.className = 'piece';
                        pieceElement.textContent = this.getPieceSymbol(piece);
                        square.appendChild(pieceElement);
                    }
                }
            }
        }
    }
    
    // AI 이동 (Stockfish 활용)
    makeAIMove() {
        if (this.chess.game_over()) return;
        
        const status = document.getElementById('status');
        status.textContent = "AI가 생각 중...";
        
        // 현재 FEN 위치 가져오기
        const fen = this.chess.fen();
        
        // Stockfish 엔진에게 최선의 수 계산 요청
        this.stockfishEngine.findBestMove(fen, (bestMoveStr) => {
            if (!bestMoveStr || bestMoveStr === '(none)') {
                console.error("AI가 유효한 수를 찾지 못했습니다.");
                status.textContent = `현재 상태: ${this.chess.turn() === 'w' ? "흰색" : "검은색"} 차례`;
                return;
            }
            
            // 수를 from, to로 파싱 (e2e4 형식)
            const fromSquare = bestMoveStr.substring(0, 2);
            const toSquare = bestMoveStr.substring(2, 4);
            
            // 승진인 경우 (e7e8q 형식)
            let promotion = undefined;
            if (bestMoveStr.length > 4) {
                promotion = bestMoveStr.charAt(4);
            }
            
            console.log(`AI 추천 수: ${fromSquare} -> ${toSquare}${promotion ? ` (${promotion}으로 승진)` : ''}`);
            
            // 이동 실행
            try {
                const moveResult = this.chess.move({
                    from: fromSquare,
                    to: toSquare,
                    promotion: promotion
                });
                
                if (moveResult) {
                    this.clearSelection();
                    this.refreshBoard();
                    this.updateStatus();
                    this.updateMoveList();
                    
                    // 체크 강조 표시
                    this.highlightCheck();
                }
            } catch (e) {
                console.error("AI move error:", e);
                alert("AI 이동 중 오류가 발생했습니다. 자세한 내용은 콘솔을 확인하세요.");
                status.textContent = `현재 상태: ${this.chess.turn() === 'w' ? "흰색" : "검은색"} 차례`;
            }
        });
    }
    
    // 무르기
    undoMove() {
        if (this.chess.history().length === 0) return;
        
        // 이동 취소
        this.chess.undo();
        
        // UI 업데이트
        this.clearSelection();
        this.refreshBoard();
        this.updateStatus();
        this.updateMoveList();
    }
    
    // 새 게임
    newGame() {
        this.chess.reset();
        this.clearSelection();
        this.initializeBoard();
    }
}

// 게임 초기화
document.addEventListener('DOMContentLoaded', () => {
    if (typeof Chess !== 'undefined') {
        const game = new ChessGame();
        window.chessGame = game; // 디버깅을 위해 전역 변수로 저장
    } else {
        console.error("Chess.js 라이브러리가 로드되지 않았습니다.");
        alert("Chess.js 라이브러리가 로드되지 않았습니다. 페이지를 새로고침하거나 콘솔을 확인하세요.");
    }
});