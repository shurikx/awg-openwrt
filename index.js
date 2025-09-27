const axios = require('axios');
const cheerio = require('cheerio');
const core = require('@actions/core');

const version = process.argv[2]; // Получение версии OpenWRT из аргумента командной строки

if (!version) {
  core.setFailed('Version argument is required');
  process.exit(1);
}

const url = `https://downloads.openwrt.org/releases/${version}/targets/`;

async function fetchHTML(url) {
  try {
    const { data } = await axios.get(url);
    return cheerio.load(data);
  } catch (error) {
    console.error(`Error fetching HTML for ${url}: ${error}`);
    throw error;
  }
}

async function getDetails(target, subtarget) {
  const packagesUrl = `${url}${target}/${subtarget}/packages/`;
  const $ = await fetchHTML(packagesUrl);
  let vermagic = '';
  let pkgarch = '';

  $('a').each((index, element) => {
    const name = $(element).attr('href');
    if (name && name.startsWith('kernel_')) {
      const vermagicMatch = name.match(/kernel_\d+\.\d+\.\d+(?:-\d+)?[-~]([a-f0-9]+)(?:-r\d+)?_([a-zA-Z0-9_-]+)\.ipk$/);
      if (vermagicMatch) {
        vermagic = vermagicMatch[1];
        pkgarch = vermagicMatch[2];
      }
    }
  });

  return { vermagic, pkgarch };
}

async function main() {
  try {
    const allowed = [
      { pkgarch: "mipsel_24kc", target: "ramips", subtarget: "mt7621" },
      { pkgarch: "aarch64_cortex-a53", target: "mediatek", subtarget: "filogic" }
    ];

    const jobConfig = [];
    for (const a of allowed) {
      const { vermagic, pkgarch } = await getDetails(a.target, a.subtarget);
      jobConfig.push({
        tag: version,
        target: a.target,
        subtarget: a.subtarget,
        vermagic,
        pkgarch,
      });
    }

    core.setOutput('job-config', JSON.stringify(jobConfig));
  } catch (error) {
    core.setFailed(error.message);
  }
}

main();
