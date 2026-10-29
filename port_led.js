import { brUuid } from './utils/constants.js';
import { getAppVersion } from './utils/getAppVersion.js';
import { getPortLedCfg } from './utils/getPortLedCfg.js';
import { setPortLedCfg } from './utils/setPortLedCfg.js';
import { setPortLedIdentify } from './utils/setPortLedIdentify.js';

// Mirror of struct port_led_cfg in BlueRetro main/system/port_led.h
const cfgVersion = 1;
const offEnable = 1;
const offGpio = 2;
const offChain = 3;
const offColor = 7;
const portCnt = 4;
const chainNames = ['1st (Red)', '2nd (Green)', '3rd (Blue)', '4th (Yellow)'];
const colorNames = ['Wired controller', 'BT controller connected', 'Pairing (breathing)', 'Button mode (flashing)'];
const defaultCfg = [
    cfgVersion, 0, 21,
    0, 1, 2, 3,
    0xFF, 0xFF, 0xFF, 50, /* Wired: White */
    0x00, 0x00, 0xFF, 50, /* BT: Blue */
    0x00, 0x00, 0xFF, 50, /* Pairing: Blue */
    0xFF, 0x90, 0x00, 50, /* Button: Amber */
];

var bluetoothDevice;
let brService = null;
let cfg = new Uint8Array(defaultCfg);
let bleQueue = Promise.resolve();
let previewTimer = null;

// Web Bluetooth doesn't allow concurrent GATT operations
function queue(op) {
    bleQueue = bleQueue.then(op).catch(error => {
        log('Argh! ' + error);
    });
    return bleQueue;
}

function toHex(r, g, b) {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function onDisconnected() {
    log('> Bluetooth Device disconnected');
    document.getElementById("divBtConn").style.display = 'block';
    document.getElementById("divInfo").style.display = 'none';
    document.getElementById("divPortLed").style.display = 'none';
}

function cfgToDom() {
    document.getElementById("ledEnable").checked = cfg[offEnable] != 0;
    document.getElementById("ledGpio").value = cfg[offGpio];
    for (let i = 0; i < portCnt; i++) {
        document.getElementById("ledChain" + i).value = cfg[offChain + i];
    }
    for (let i = 0; i < colorNames.length; i++) {
        let off = offColor + i * 4;
        document.getElementById("ledColor" + i).value = toHex(cfg[off], cfg[off + 1], cfg[off + 2]);
        document.getElementById("ledBright" + i).value = cfg[off + 3];
        document.getElementById("ledBrightVal" + i).textContent = cfg[off + 3] + '%';
    }
}

function domToCfg() {
    cfg[0] = cfgVersion;
    cfg[offEnable] = document.getElementById("ledEnable").checked ? 1 : 0;
    cfg[offGpio] = Number(document.getElementById("ledGpio").value);
    for (let i = 0; i < portCnt; i++) {
        cfg[offChain + i] = Number(document.getElementById("ledChain" + i).value);
    }
    for (let i = 0; i < colorNames.length; i++) {
        let off = offColor + i * 4;
        let hex = document.getElementById("ledColor" + i).value;
        cfg[off] = parseInt(hex.substr(1, 2), 16);
        cfg[off + 1] = parseInt(hex.substr(3, 2), 16);
        cfg[off + 2] = parseInt(hex.substr(5, 2), 16);
        cfg[off + 3] = Number(document.getElementById("ledBright" + i).value);
        document.getElementById("ledBrightVal" + i).textContent = cfg[off + 3] + '%';
    }
}

function previewEvent() {
    domToCfg();
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
        queue(() => setPortLedCfg(brService, cfg, false));
    }, 150);
}

function saveEvent() {
    domToCfg();
    clearTimeout(previewTimer);
    queue(() => setPortLedCfg(brService, cfg, true))
    .then(() => queue(() => getPortLedCfg(brService)))
    .then(value => {
        // FW silently reject invalid cfg, read back to confirm
        if (value && value.every((x, i) => x == cfg[i])) {
            log('Port LED config saved');
        }
        else {
            log('Port LED config rejected by BlueRetro');
        }
    });
}

function defaultEvent() {
    let enable = cfg[offEnable];
    let gpio = cfg[offGpio];

    // Keep current enable state and GPIO
    cfg = new Uint8Array(defaultCfg);
    cfg[offEnable] = enable;
    cfg[offGpio] = gpio;
    cfgToDom();
    previewEvent();
}

function identifyEvent() {
    queue(() => setPortLedIdentify(brService))
    .then(() => log('Chain order pattern shown for 10 seconds'));
}

export function initPortLedDom() {
    let chain = document.getElementById("tableChain");
    for (let i = 0; i < portCnt; i++) {
        let row = chain.insertRow();
        row.insertCell().textContent = 'Port ' + (i + 1) + ' LED';
        let sel = document.createElement("select");
        sel.id = "ledChain" + i;
        chainNames.forEach((name, j) => sel.add(new Option(name, j)));
        sel.addEventListener('change', previewEvent);
        row.insertCell().appendChild(sel);
    }

    let color = document.getElementById("tableColor");
    colorNames.forEach((name, i) => {
        let row = color.insertRow();
        row.insertCell().textContent = name;

        let picker = document.createElement("input");
        picker.type = "color";
        picker.id = "ledColor" + i;
        picker.addEventListener('input', previewEvent);
        row.insertCell().appendChild(picker);

        let bright = document.createElement("input");
        bright.type = "range";
        bright.min = 0;
        bright.max = 100;
        bright.id = "ledBright" + i;
        bright.addEventListener('input', previewEvent);
        row.insertCell().appendChild(bright);

        let val = document.createElement("span");
        val.id = "ledBrightVal" + i;
        row.insertCell().appendChild(val);
    });

    document.getElementById("ledEnable").addEventListener('change', previewEvent);
    document.getElementById("ledGpio").addEventListener('change', previewEvent);
    document.getElementById("btnIdentify").addEventListener('click', identifyEvent);
    document.getElementById("btnSave").addEventListener('click', saveEvent);
    document.getElementById("btnDefault").addEventListener('click', defaultEvent);
    cfgToDom();
}

export function btConn() {
    log('Requesting Bluetooth Device...');
    navigator.bluetooth.requestDevice(
        {filters: [{namePrefix: 'BlueRetro'}],
        optionalServices: [brUuid[0]]})
    .then(device => {
        log('Connecting to GATT Server...');
        bluetoothDevice = device;
        bluetoothDevice.addEventListener('gattserverdisconnected', onDisconnected);
        return bluetoothDevice.gatt.connect();
    })
    .then(server => {
        log('Getting BlueRetro Service...');
        return server.getPrimaryService(brUuid[0]);
    })
    .then(service => {
        brService = service;
        return getAppVersion(brService);
    })
    .then(value => {
        document.getElementById("divInfo").innerHTML = 'Connected to: ' + bluetoothDevice.name + ' [' + value + ']';
        log('Reading port LED config...');
        return getPortLedCfg(brService);
    })
    .then(value => {
        cfg = value;
        cfgToDom();
        document.getElementById("divBtConn").style.display = 'none';
        document.getElementById("divInfo").style.display = 'block';
        document.getElementById("divPortLed").style.display = 'block';
    })
    .catch(error => {
        log('Argh! ' + error);
    });
}
