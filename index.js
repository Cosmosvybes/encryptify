#! /usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import Server from "./main.js";
const program = new Command();
const server = new Server();
program
  .name("yup")
  .description("Local files CLI encryption tool")
  .version("1.0.2");

program
  .command("start")
  .description("Start the server with your port")
  .option("-p, --port <port>", "Server port here -p")
  .action((options) => {
    if (!options.port) {
      console.log(chalk.red("Operation failed , no port -p"));
      return;
    }
    server.start(options.port);
  });

program
  .command("read")
  .description("read any file data to the console")
  .option("-f, --file <file>", "Enter the file name -f")
  .action((options) => {
    if (!options.file || !options.mode) {
      console.log(
        chalk.red("file name is missing -f or read mode -m not specified")
      );
      return;
    }
    server.readfile(options.file);
  });

program
  .command("encrypt")
  .description("Encrypt any file in your directory")
  .option("-f, --file <file>", "Enter the file name with the -f flag")
  .action((options) => {
    if (!options.file) {
      return console.log(chalk.red("Missing file input"));
    }
    server.encrypt(options.file);
  });

program
  .command("decrypt")
  .description("Decrypt any file encrypted file in your directory")
  .option("-f , --file <file>", "Enter the file name with -f flag")
  .action((options) => {
    if (!options.file) {
      return console.log(chalk.red("missing file input args -f"));
    }
    server.decrypt(options.file);
  });
program.parse(process.argv);
