import { Project } from "../../../editor/api/projects/types"; 

class InstanceEditor {
    rootDirectory: string;
    baseJS: string;
    configDirectory: string = ".config/fullstacked";
    nodeModulesDirectory: string = this.configDirectory + "/node_modules";
    cacheDirectory: string = ".cache/fullstacked";

    constructor(){
        
    }
}