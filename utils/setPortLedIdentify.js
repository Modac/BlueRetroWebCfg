import { brUuid, cfg_cmd_port_led_identify } from "../utils/constants.js";

export const setPortLedIdentify = (service) => {
  return new Promise((resolve, reject) => {
    service
      .getCharacteristic(brUuid[7])
      .then((chrc) => {
        return chrc.writeValue(new Uint8Array([cfg_cmd_port_led_identify]));
      })
      .then((_) => {
        resolve();
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export default setPortLedIdentify;
