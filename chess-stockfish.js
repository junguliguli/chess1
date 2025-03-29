/**
 * Stockfish 체스 엔진 연동 클래스
 * stockfish.js 라이브러리를 사용합니다.
 */
class StockfishEngine {
    constructor(depth = 5) {
        this.engine = null;
        this.isReady = false;
        this.onReadyCallback = null;
        this.onMoveCallback = null;
        this.searchDepth = depth; // 탐색 깊이 (기본값 5)
        this.initEngine();
    }
    
    // 엔진 초기화
    initEngine() {
    // 로컬에 저장된 stockfish.js 파일 사용
    this.engine = new Worker('./stockfish.js');
    
    // 엔진 메시지 처리
    this.engine.onmessage = (event) => {
        const message = event.data;
        
        // 준비 완료 메시지
        if (message === 'readyok') {
            this.isReady = true;
            if (this.onReadyCallback) {
                this.onReadyCallback();
            }
        }
        
        // 최선의 수 찾기 메시지
        if (message.startsWith('bestmove')) {
            const moveStr = message.split(' ')[1];
            if (this.onMoveCallback && moveStr) {
                this.onMoveCallback(moveStr);
            }
        }
        
        // 디버깅용 로그
        console.log('Engine:', message);
    };
    
    // 엔진 설정
    this.sendCommand('uci');
    this.sendCommand('isready');
}
    
    // 엔진에 명령 전송
    sendCommand(cmd) {
        if (this.engine) {
            this.engine.postMessage(cmd);
        }
    }
    
    // 준비 완료 콜백 설정
    onReady(callback) {
        this.onReadyCallback = callback;
        if (this.isReady && callback) {
            callback();
        }
    }
    
    // 최선의 수 찾기 콜백 설정
    onBestMove(callback) {
        this.onMoveCallback = callback;
    }
    
    // 현재 FEN 위치에서 최선의 수 찾기
    findBestMove(fen, callback) {
        this.onBestMove(callback);
        
        // 위치 설정
        this.sendCommand('position fen ' + fen);
        
        // 최선의 수 계산 (depth 지정)
        this.sendCommand('go depth ' + this.searchDepth);
    }
    
    // 엔진 종료
    quit() {
        if (this.engine) {
            this.sendCommand('quit');
            this.engine.terminate();
            this.engine = null;
        }
    }
}

// 글로벌 객체로 내보내기
window.StockfishEngine = StockfishEngine;