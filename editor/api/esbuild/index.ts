declare var checkEsbuildInstall: () => boolean;
declare var installEsbuild: () => void;

export default {
    checkInstall: () => checkEsbuildInstall(),
    install: () => installEsbuild()
};
