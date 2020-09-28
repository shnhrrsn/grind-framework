import { Inflect as BaseInflect } from '@grindjs/support'

export const Inflect = { ...BaseInflect }

const foreignKey = Inflect.foreign_key
delete Inflect.foreign_key

Inflect.foreignKey = val => foreignKey(val.replace(/Model$/, ''))
