/** Power Station, level 2 — see power-station.js. */
import { buildPowerStation, outputFor } from './power-station.js'

export const output = outputFor()
export default () => buildPowerStation(2)
