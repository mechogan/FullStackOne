(Uint8Array.prototype as any).toJSON = function(){
    return Array.from(this);
}
