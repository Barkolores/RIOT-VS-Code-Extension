
/**@see {implementsFlashInterface} ts-auto-guard:type-guard*/
export interface FlashInterface {
    /**ts-auto-guard-suppress function-type*/
    flash(binaries: {[offset:string]: Uint8Array}, args: string): Promise<void>
}