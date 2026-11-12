const MAX_HISTORY = 500;
const _history: string[] = [];
let _index = 0;

export function getCommandHistory() {
    return _history;
}

export function clearHistory() {
    _history.length = 0;
    _index = 0;
}

export function addCommand(command: string) {
    _history.push(command);
    if (_history.length > MAX_HISTORY) _history.splice(0, _history.length - MAX_HISTORY); // keep the newest
    _index = _history.length;
}

export function goUp() {
    if (_index > 0) {
        _index--;
        return _history[_index];
    }
}

export function goDown() {
    if (_index < _history.length - 1) {
        _index++;
        return _history[_index];
    }
    if (_index === _history.length - 1) {
        _index = _history.length;
        return '';
    }
}