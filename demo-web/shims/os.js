// A shop's WiFi address, for the Phone and price checker screen (nothing listens in the page)
const shopWifi = () => ({ 'Wi-Fi': [{ family: 'IPv4', address: '192.168.1.10', internal: false }] });
const os = { networkInterfaces: shopWifi, platform: () => 'win32', homedir: () => '/afus/home', tmpdir: () => '/afus/temp', hostname: () => 'demo', type: () => 'Windows_NT', release: () => '10', arch: () => 'x64', cpus: () => [{}], totalmem: () => 8e9, freemem: () => 4e9, EOL: '\n', userInfo: () => ({ username: 'demo' }) };
export default os;
export const { networkInterfaces, platform, homedir, tmpdir, hostname, type, release, arch, cpus, totalmem, freemem, EOL, userInfo } = os;
