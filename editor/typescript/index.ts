const w = new Worker("worker.js", { type: "module" });
w.onmessage = function(event){
    console.log(event.data)
};