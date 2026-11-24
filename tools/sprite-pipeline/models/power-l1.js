/** Power Station, level 1 — see power-station.js. */
import { buildPowerStation, outputFor } from './power-station.js'

export const output = outputFor()
export default () => buildPowerStation(1)
