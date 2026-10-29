import { mtu } from "../utils/constants.js";

// Number of chunks sent without response before a write with response
// is used to resync with BlueRetro (16 * 244 bytes ~= 4 KB).
const chunksPerSync = 16;

const otaWriteFwRecursive = async (chrc, data, offset, setProgress, cancel) => {
    // Older FW only support write with response
    let fastWrite = chrc.properties.writeWithoutResponse
      && typeof chrc.writeValueWithoutResponse === "function";
    let chunk = 0;

    while (offset < data.byteLength) {
      if (cancel.current === 1) {
        throw new Error("Cancelled");
      }
      let tmpViewSize = Math.min(data.byteLength - offset, mtu);
      let tmpView = new DataView(data, offset, tmpViewSize);
      offset += tmpViewSize;
      chunk++;

      // Last chunk always with response so it's processed before OTA end cmd
      let sent = false;
      if (fastWrite && (chunk % chunksPerSync) && offset < data.byteLength) {
        try {
          await chrc.writeValueWithoutResponse(tmpView);
          sent = true;
        }
        catch (error) {
          // Some platforms reject it, fall back to the slow path
          console.log("Write without response failed, fallback: " + error);
          fastWrite = false;
        }
      }
      if (!sent) {
        if (typeof chrc.writeValueWithResponse === "function") {
          await chrc.writeValueWithResponse(tmpView);
        }
        else {
          await chrc.writeValue(tmpView);
        }
        setProgress(Math.round((offset / data.byteLength) * 100));
      }
    }
  };

  export default otaWriteFwRecursive;
