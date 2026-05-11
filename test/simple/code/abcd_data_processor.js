const fs = require("fs");

function process_report(storage_context, enclave_hash, request_hash, report){
    const data = fs.readFileSync(report, "utf-8");
    const meta = { enclave_hash, request_hash, data };
    return meta;
}

module.exports = process_report;