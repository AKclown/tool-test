import { spawn } from "child_process";

const command = `ls -la`;
const cwd = process.cwd();

const [cmd, ...args] = command.split(" ");

const child = spawn(cmd, args, { cwd, stdio: "inherit", shell: true });

let errorMsg = "";

child.on("error", (err) => {
  errorMsg = err.message;
});

child.on("close", (code) => {
  if (code === 0) {
    process.exit(0);
  } else {
    if (errorMsg) {
      console.log(`错误: ${errorMsg}`);
    }
    process.exit(code);
  }
});


