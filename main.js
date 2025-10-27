import { EventEmitter } from "events";
import http from "http";
import chalk from "chalk";
import { close, open, readdir, readFile, writeFile } from "fs";
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomFill,
  scrypt,
} from "crypto";
import cluster from "cluster";
import os from "os";

class Server extends EventEmitter {
  constructor() {
    super();
    this.algorithm = "aes-192-cbc";
    this.password = "The password for the encryption";
    this.salt = "salt";
    this.on("start", (server) => {
      console.log("server connected", server);
    });
  }

  start(port) {
    const sv = http.createServer((req, res) => {
      switch (req.url) {
        case "/api/encryptify":
          res.writeHead(200, { "content-type": "application/json" });
          return res.end(JSON.stringify({ res: "Server encrypting route" }));
        case "/api/read/files":
          res.writeHead(200, { "content-type": "application/json" });
          readFile("log.json", { encoding: "utf-8" }, (err, chunk) => {
            if (err) throw err;
            const data = JSON.parse(chunk);
            res.end(JSON.stringify(data));
          });
          return;
        case "/api/encrypted/files":
          res.writeHead(200, { "content-type": "application/json" });
          readFile("encrypted.json", { encoding: "utf-8" }, (err, chunk) => {
            if (err) throw err;
            const data = JSON.parse(chunk);
            res.end(JSON.stringify(data));
          });
          return;
        default:
          res.writeHead(200, { "content-type": "application/json" });
          return res.end(JSON.stringify({ res: "Server default route" }));
      }
    });
    if (cluster.isPrimary) {
      for (let i = 0; i < os.availableParallelism; i++) {
        cluster.fork();
      }
      cluster.on("exit", (err, worker) => {
        if (err) throw err;
        cluster.fork();
        console.log(`${worker.process.pid} died and new worker started`);
      });
    } else {
      sv.listen(port, (err) =>
        console.log(
          chalk.green(
            `Server running port ${port}  by worker ${process.pid} ✅`
          )
        )
      );
      this.emit("start", process.pid);
    }
  }

  // function read file
  readfile(file) {
    readdir(".", { encoding: "utf-8" }, (err, files) => {
      if (err) throw err;
      if (files.includes(file)) {
        readFile(file, { encoding: "utf-8" }, (err, fileChunk) => {
          if (err) throw err;
          open("log.json", "wx", (err, fd) => {
            if (err) {
              if (err.code === "EEXIST") {
                readFile("log.json", { encoding: "utf-8" }, (err, chunk) => {
                  if (err) throw err;
                  const logs = JSON.parse(chunk);
                  logs.push({ data: fileChunk });
                  // console.log(logs);
                  writeFile("log.json", JSON.stringify(logs), (err) => {
                    if (err) throw err;
                    console.log(chalk.green("file data logged ✅"));
                  });
                });

                return;
              }
              console.log(chalk.red("file no de"));
              return;
            }

            try {
              writeFile(
                "log.json",
                JSON.stringify([{ data: fileChunk }]),
                (err) => {
                  if (err) throw err;
                  console.log(chalk.green("file created; data  logged ✅"));
                }
              );
            } finally {
              close(fd, (err) => {
                if (err) throw err;
              });
            }
          });
        });
      } else {
        console.log(chalk.red("file doesn't exist"));
      }
    });
  }

  encrypt(file) {
    scrypt(this.password, this.salt, 24, (err, key) => {
      if (err) throw err;
      randomFill(new Uint8Array(16), (err, iv) => {
        if (err) throw err;
        const cipher = createCipheriv(this.algorithm, key, iv);
        readdir(".", { encoding: "utf-8" }, (err, files) => {
          if (err) throw err;

          if (files.includes(file)) {
            readFile(file, { encoding: "utf-8" }, (err, chunk) => {
              if (!err) {
                const encrypted = cipher.update(chunk, "utf-8", "hex");
                const hashed = createHmac("sha256", this.salt)
                  .update(encrypted)
                  .digest("hex");
                let log = { file, hashed, encrypted };

                open("encrypted.json", "wx", (err, fd) => {
                  if (err) {
                    if (err.code === "EEXIST") {
                      readFile(
                        "encrypted.json",
                        { encoding: "utf-8" },
                        (err, chunk_) => {
                          if (err) throw err;

                          const logs = JSON.parse(chunk_);
                          let isExisting = logs.find((log) => log.file == file);
                          if (!isExisting) {
                            logs.push(log);
                            writeFile(
                              "encrypted.json",
                              JSON.stringify(logs),
                              { encoding: "utf-8" },
                              (err) => {
                                if (err) throw err;
                                console.log("new encrypted data logged");
                              }
                            );
                          } else {
                            console.log(
                              chalk.blue("File already encrypted 🚧")
                            );
                          }
                        }
                      );
                    }
                    return;
                  }
                  try {
                    // console.log(log)
                    writeFile(
                      "encrypted.json",
                      JSON.stringify([log]),
                      { encoding: "utf-8" },
                      (err) => {
                        if (err) throw err;
                        console.log("Encryption successful; file logged");
                      }
                    );
                  } finally {
                    close(fd, (err) => {
                      if (!err) return console.log("File closed");
                      throw err;
                    });
                  }
                });
              }
            });
          } else {
            console.log(chalk.red("file not found"));
          }
        });
      });
    });
  }

  decrypt(file) {
    readdir(".", { encoding: "utf-8" }, (err, files) => {
      if (err) throw err;

      if (files.includes("encrypted.json")) {
        readFile("encrypted.json", { encoding: "utf-8" }, (err, chunk) => {
          if (err) return console.log(chalk.red("Error reading file"));
          const logs = JSON.parse(chunk);
          let data = logs.find((log) => log.file == file);
         
          if (!data) return console.log(chalk.red("File not found"));
          this.decipher(data.encrypted, file);
        });
      } else {
        console.log(chalk.red("No file has been encrypted yet! "));
      }
    });
  }

  decipher(enc, name) {
    scrypt(this.password, this.salt, 24, (err, key) => {
      if (err) throw err;
      const iv = Buffer.alloc(16, 0);
      const decipher = createDecipheriv(this.algorithm, key, iv);
      const dec = decipher.update(enc, "hex", "utf-8");
      writeFile(`_${name}`, dec, { encoding: "utf-8" }, (err) => {
        if (err) throw err;
        console.log(chalk.green("Decryption completed!!"));
      });
    });
  }
}

export default Server;

// const server = new Server();
// server.decrypt("Readme.md");
