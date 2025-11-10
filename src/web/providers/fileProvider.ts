import vscode, {env} from "vscode";

export class FileProvider {

    async loadBinary(file: vscode.Uri): Promise<string> {
        return new Promise(
            (resolve, reject) => {
                vscode.workspace.fs.readFile(file).then(
                    (value: Uint8Array<ArrayBufferLike>) => resolve([...new Uint8Array(value)].map(v => String.fromCharCode(v)).join('')),
                    () => {
                        vscode.window.showErrorMessage('Failed to read file: ' + file.toString());
                        reject('Failed to read file: ' + file.toString());
                        return;
                    }
                );
            }
        );
    }

    async loadJson(file: vscode.Uri): Promise<object> {
        return new Promise(
            (resolve, reject) => {
                vscode.workspace.fs.readFile(file).then((value: Uint8Array<ArrayBufferLike>) => {
                        try {
                            resolve(JSON.parse(new TextDecoder('utf-8').decode(value)));
                            return;
                        } catch (e) {
                            reject(e);
                            return;
                        }
                    }
                );
            }
        );
    }
}