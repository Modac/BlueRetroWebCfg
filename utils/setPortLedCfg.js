import { brUuid, cfg_cmd_set_port_led_cfg, cfg_cmd_save_port_led_cfg } from "../utils/constants.js";

// Apply cfg right away, also store it on BlueRetro if save is true.
export const setPortLedCfg = (service, cfg, save) => {
  return new Promise((resolve, reject) => {
    var cmd = new Uint8Array(1 + cfg.length);
    var cmd_chrc;
    service
      .getCharacteristic(brUuid[7])
      .then((chrc) => {
        cmd_chrc = chrc;
        cmd[0] = cfg_cmd_set_port_led_cfg;
        cmd.set(cfg, 1);
        return cmd_chrc.writeValue(cmd);
      })
      .then((_) => {
        if (save) {
          return cmd_chrc.writeValue(new Uint8Array([cfg_cmd_save_port_led_cfg]));
        }
      })
      .then((_) => {
        resolve();
      })
      .catch((error) => {
        reject(error);
      });
  });
};

export default setPortLedCfg;
