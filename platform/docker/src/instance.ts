import { Project } from "../../../editor/api/projects/types";
import { Instance as InstanceInterface } from "../../node/interfaces/instance";
import ws from "ws";
import { InstanceWebSocket } from "../../node/src/instanceWebSocket";

export class InstanceDocker extends InstanceWebSocket implements InstanceInterface {



    constructor(project: Project) {
        super(new ws.WebSocketServer({ noServer: true }));
        
    }



    start() { }
}