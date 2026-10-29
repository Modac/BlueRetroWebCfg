import { brUuid, cfg_cmd_get_port_led_cfg } from "../utils/constants.js";

export const portLedCfgSize = 23;

export const getPortLedCfg = (service) => {
  return new Promise((resolve, reject) => {
    var cmd = new Uint8Array(1);
    var cmd_chrc;
    service
      .getCharacteristic(brUuid[7])
      .then((chrc) => {
        cmd_chrc = chrc;
        cmd[0] = cfg_cmd_get_port_led_cfg;
        return cmd_chrc.writeValue(cmd);
      })
      .then((_) => {
        return cmd_chrc.readValue();
      })
      .then((value) => {
        // Older FW answer unknown cmd with the 1 byte ABI version
        if (value.byteLength != portLedCfgSize) {
          throw Error("FW does not support port LEDs, please update BlueRetro");
        }
        resolve(new Uint8Array(value.buffer));
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export default getPortLedCfg;
