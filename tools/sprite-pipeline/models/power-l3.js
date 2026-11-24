/** Power Station, level 3 — see power-station.js. */
import { buildPowerStation, outputFor } from './power-station.js'

export const output = outputFor()
export default () => buildPowerStation(3)
