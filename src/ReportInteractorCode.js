class ReportInteractorCode {
    constructor() {
        this.map = new Map();
        this.interval = setInterval(this.decrementCounters.bind(this), 60000);
    }

    // 访问方法：增加 counter 并返回 object
    access(enclave_hash) {
        if (this.map.has(enclave_hash)) {
            const entry = this.map.get(enclave_hash);
            entry.counter += 5; // 每次访问，增加 counter
            return entry.object;
        } else {
            return null; // 如果没有该 enclave_hash，返回 null
        }
    }

    // 每分钟调用，减少所有 entries 的 counter
    decrementCounters() {
        for (const [enclave_hash, entry] of this.map.entries()) {
            entry.counter -= 1;
            if (entry.counter <= 0) {
                console.log(`Removing object with enclave_hash: ${enclave_hash}`);
                this.map.delete(enclave_hash); // 如果 counter 为 0，删除 entry
            }
        }
    }

    // 向 map 中添加一个新条目
    add(enclave_hash, object) {
        if (!this.map.has(enclave_hash)) {
            this.map.set(enclave_hash, { object, counter: 5 }); // 初始化 counter 为 5
        }
    }

    // 停止定时器（可以用于关闭时清理）
    stop() {
        clearInterval(this.interval);
    }
}

module.exports = ReportInteractorCode;
