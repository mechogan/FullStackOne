export const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

export const throwError = (message: string) => {
    const error = Error(message);
    console.error(error);
    process.exit(1);
};
