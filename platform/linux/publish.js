import fs from "node:fs";
import path from "node:path";
import child_process from "node:child_process";
import os from "node:os";
import url from "node:url"
import dotenv from "dotenv";
import version from "../../version.js";

const currentDirectory = path.dirname(url.fileURLToPath(import.meta.url));
const rootDirectory = path.resolve(currentDirectory, "..", "..");

const arch = os.arch();

// build editor

child_process.execSync("npm run build -- --production", {
    cwd: rootDirectory,
    stdio: "inherit"
});

// build core

child_process.execSync(`make linux-${arch}-static -j4`, {
    cwd: path.resolve(rootDirectory, "core", "build"),
    stdio: "inherit"
});

// update version

const controlFile = path.resolve(currentDirectory, "control");
const controlFileContent = fs.readFileSync(controlFile, {
    encoding: "utf-8"
});
const controlFileContentUpdated = controlFileContent
    .replace(
        /Version\:.*\n/g,
        `Version: ${version.major}.${version.minor}.${version.patch}\n`
    );
fs.writeFileSync(controlFile, controlFileContentUpdated);

// build GTK

child_process.execSync(`sh ./build-gtk.sh ${arch}`, {
    cwd: currentDirectory,
    stdio: "inherit"
});

// pkg GTK

child_process.execSync(`sh ./pkg.sh`, {
    cwd: currentDirectory,
    stdio: "inherit"
});

const debPackageGTK = path.resolve(currentDirectory, `fullstacked-${version.major}.${version.minor}.${version.patch}-linux-${arch}-gtk-${version.build}.deb`)

fs.renameSync(
    path.resolve(currentDirectory, "fullstacked.deb"),
    debPackageGTK
);

// build Qt

child_process.execSync(`cmake -DARCH=${arch} .`, {
    cwd: currentDirectory,
    stdio: "inherit"
});

child_process.execSync(`make -j4`, {
    cwd: currentDirectory,
    stdio: "inherit"
});

// pkg Qt

const debPackageQt = path.resolve(currentDirectory, `fullstacked-${version.major}.${version.minor}.${version.patch}-linux-${arch}-qt-${version.build}.deb`)

child_process.execSync(`sh ./pkg.sh`, {
    cwd: currentDirectory,
    stdio: "inherit"
});

fs.renameSync(
    path.resolve(currentDirectory, "fullstacked.deb"),
    debPackageQt
);


// Upload to GitHub

const { TOKEN } = dotenv.parse(
    fs.readFileSync(path.resolve(currentDirectory, "GITHUB.env"))
);

await uploadDebToReleaseByTag({
    tag: `${version.major}.${version.minor}.${version.patch}`,
    debFilePath: debPackageGTK,
    token: TOKEN
});
await uploadDebToReleaseByTag({
    tag: `${version.major}.${version.minor}.${version.patch}`,
    debFilePath: debPackageQt,
    token: TOKEN
});


// upload to github release

async function uploadDebToReleaseByTag(options) {
    const {
        owner = "fullstackedorg",
        repo = "fullstacked",
        tag,
        debFilePath,
        token,
        releaseName = tag,
        releaseBody = `Release ${tag}`,
        prerelease = false,
        draft = true
    } = options;


    try {
        // Check if the .deb file exists
        if (!fs.existsSync(debFilePath)) {
            throw new Error(`File not found: ${debFilePath}`);
        }

        let releaseId;

        // Try to get existing release by tag (published releases only)
        try {
            console.log(`Checking if published release with tag ${tag} exists...`);
            const getReleaseResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/tags/${tag}`, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (getReleaseResponse.ok) {
                const existingRelease = await getReleaseResponse.json();
                releaseId = existingRelease.id;
                console.log(`Found existing published release with ID: ${releaseId}`);
            } else if (getReleaseResponse.status === 404) {
                // Check for draft releases that might have the same tag
                console.log(`No published release found. Checking for draft releases with tag ${tag}...`);

                const allReleasesResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
                    headers: {
                        'Authorization': `token ${token}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                });

                if (allReleasesResponse.ok) {
                    const allReleases = await allReleasesResponse.json();
                    const draftRelease = allReleases.find(release =>
                        release.tag_name === tag && release.draft === true
                    );

                    if (draftRelease) {
                        releaseId = draftRelease.id;
                        console.log(`Found existing draft release with ID: ${releaseId}`);
                    } else {
                        // No release found, create new one
                        console.log(`No release found. Creating new release with tag ${tag}...`);

                        const createReleaseResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `token ${token}`,
                                'Accept': 'application/vnd.github.v3+json',
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                tag_name: tag,
                                name: releaseName,
                                body: releaseBody,
                                draft: draft,
                                prerelease: prerelease
                            })
                        });

                        if (!createReleaseResponse.ok) {
                            const errorText = await createReleaseResponse.text();
                            throw new Error(`Failed to create release: ${createReleaseResponse.status} ${createReleaseResponse.statusText} - ${errorText}`);
                        }

                        const newRelease = await createReleaseResponse.json();
                        releaseId = newRelease.id;
                        console.log(`Created new release with ID: ${releaseId}`);
                    }
                } else {
                    const errorText = await allReleasesResponse.text();
                    throw new Error(`Failed to fetch releases: ${allReleasesResponse.status} ${allReleasesResponse.statusText} - ${errorText}`);
                }
            } else {
                const errorText = await getReleaseResponse.text();
                throw new Error(`Failed to check release: ${getReleaseResponse.status} ${getReleaseResponse.statusText} - ${errorText}`);
            }
        } catch (error) {
            if (error.message.includes('Failed to check release') || error.message.includes('Failed to create release') || error.message.includes('Failed to fetch releases')) {
                throw error;
            }
            throw new Error(`Error checking/creating release: ${error.message}`);
        }

        // Read the .deb file
        console.log(`Reading .deb file: ${debFilePath}`);
        const debFile = fs.readFileSync(debFilePath);
        const fileName = path.basename(debFilePath);

        // Check if asset already exists
        const assetsResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets`, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (assetsResponse.ok) {
            const assets = await assetsResponse.json();
            const existingAsset = assets.find(asset => asset.name.startsWith(fileName.split("-").slice(0, -1).join("-")));

            if (existingAsset) {
                console.log(`Asset ${fileName} already exists. Deleting it...`);
                const deleteResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases/assets/${existingAsset.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `token ${token}`
                    }
                });

                if (!deleteResponse.ok) {
                    console.warn(`Warning: Failed to delete existing asset: ${deleteResponse.status} ${deleteResponse.statusText}`);
                } else {
                    console.log(`Deleted existing asset: ${fileName}`);
                }
            }
        }

        // Upload the .deb file
        console.log(`Uploading ${fileName} to release...`);
        const uploadUrl = `https://uploads.github.com/repos/${owner}/${repo}/releases/${releaseId}/assets`;

        const uploadResponse = await fetch(`${uploadUrl}?name=${encodeURIComponent(fileName)}`, {
            method: 'POST',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/vnd.debian.binary-package',
                'Content-Length': debFile.length
            },
            body: debFile
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText} - ${errorText}`);
        }

        const result = await uploadResponse.json();
        console.log('✅ Upload successful!');
        console.log(`📦 File: ${result.name}`);
        console.log(`🔗 Download URL: ${result.browser_download_url}`);
        console.log(`📊 Size: ${(result.size / 1024 / 1024).toFixed(2)} MB`);

        return {
            success: true,
            asset: result,
            releaseId: releaseId,
            downloadUrl: result.browser_download_url
        };

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    }
}