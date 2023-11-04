import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import base64 from 'base-64';

const manager = new BleManager();

let subscription;

const setupNotificationListener = async (characteristic) => {
  subscription = characteristic.monitor((error, characteristic) => {
    if (error) {
      console.error(error);
      return;
    }
    const command = base64.decode(characteristic.value);
    if (command === "REQUEST_WEATHER") {
      //sendDataTemperatureToESP32();
    }
  });
};

async function sendDataToESP32(data:string|number) {

  const requestBluetoothPermission = async () => {
    if (Platform.OS === 'ios') {
      return true
    }
    if (Platform.OS === 'android' && PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION) {
      const apiLevel = parseInt(Platform.Version.toString(), 10)
  
      if (apiLevel < 31) {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)
        return granted === PermissionsAndroid.RESULTS.GRANTED
      }
      if (PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN && PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT) {
        const result = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        ])
  
        return (
          result['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
          result['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
        )
      }
    }
  
    this.showErrorToast('Permission have not been granted')
  
    return false
  }

  await requestBluetoothPermission();

 
  try {
    // Étape 1: Scannez et connectez-vous à l'ESP32
    const device = await manager.connectToDevice("8C:AA:B5:8C:50:52");
    const services = await device.discoverAllServicesAndCharacteristics();
    const service = (await services.services()).find(s => s.uuid === '4fafc201-1fb5-459e-8fcc-c5c9c331914b');
    const characteristic = (await service.characteristics()).find(c => c.uuid === 'beb5483e-36e1-4688-b7f5-ea07361b26a8');

    // Étape 1.5 : Configurer l'écouteur de notifications
    const commandCharacteristic = (await service.characteristics()).find(c => c.uuid === 'REQUEST_WEATHER');
    setupNotificationListener(commandCharacteristic);
  
    // Étape 3: Envoyez les données
    await characteristic.writeWithResponse(base64.encode(String(data)));
  } catch (error) {
    console.log(error);
  }
}

export { sendDataToESP32 };
