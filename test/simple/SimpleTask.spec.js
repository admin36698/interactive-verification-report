import {init_vrdaemon, get_express_instance, process_verfication_report, close_vrdaemon} from "../../src/VRDaemon";
import TestMetaProvider from "../TestMetaProvider";
const path = require('node:path');

import {Sealer} from "@yeez-tech/meta-encryptor";
import { Readable } from 'stream';
import {key_pair} from "../helper";
import fs from 'fs';
const request = require('supertest');
const os = require('node:os');
let meta_provider = new TestMetaProvider(path.resolve(__dirname, "VRDataProcessor.js"), path.resolve(__dirname, "VRInteractor.js"))



/*
test("init and close", async()=>{
    init_vrdaemon(meta_provider, 4698);

    console.log("init_vrdaemon done")

    close_vrdaemon();
    console.log("close_vrdaemon done")
})
    */
const storage_config = JSON.parse(`{
    "db":{
        "name":"sqlite3",
        "filename":"test_sqlite.db"
        },
    "cdn":{
    },
    "data_dir":"${__dirname.replace(/\\/g, '\\\\')}"
    }`);

    afterAll(() => {
        close_vrdaemon();
      });

test("simple code", async()=>{
    console.log("test: ", meta_provider);
    console.log(
          "meta_provider type:",
          typeof meta_provider,
          "| constructor:",
          meta_provider?.constructor?.name ?? "unknown"
        );
    init_vrdaemon(meta_provider, 4698, storage_config, __dirname);

    //simulate encrypted report, save to "dst"
    const inputString = "Hello, this is a test string.";
    const rs = Readable.from(inputString);
    const dst = path.join(__dirname, "encrypted_report.data")
    let ws = fs.createWriteStream(dst)

    rs.pipe(new Sealer({keyPair:key_pair}))
        .pipe(ws);

    await new Promise(resolve=>{
            ws.on('finish', ()=>resolve());
    })
    
    //process report
    
    await new Promise((resolve)=>{
        process_verfication_report( "req_abcdefg", dst, ()=>{
            resolve();
        })})
            
    const app = get_express_instance();
    const response = await request(app).get('/api/report').query({request_hash: "req_abcdefg"});
    console.log("response: ", response.body)
})
