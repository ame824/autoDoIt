export const EXPLOIT_COMPLETE_FILE = "/data/autoDoIt-source-file--1-complete.txt";
export const EXPLOIT_TASK_FILE = "/special/manage-exploits.js";

export function taskIsPermanentlyComplete(ns, task) {
  return task?.file === EXPLOIT_TASK_FILE &&
    String(ns.read(EXPLOIT_COMPLETE_FILE)).trim() === "11/11";
}
