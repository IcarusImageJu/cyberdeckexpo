import React, { useEffect, useState } from 'react';
import { View, Text, Button, Platform, PermissionsAndroid } from 'react-native';
import { BleManager } from 'react-native-ble-plx';
import base64 from 'base-64';
import axios from 'axios';

const manager = new BleManager();

const getTemperatureData = async (): Promise<string | null> => {
    try {
        const apiKey = '';
        const zip = '35120';
        const country = "FR";
        const city = `${zip},${country}`;
        const url = `https://api.openweathermap.org/data/2.5/weather?zip=${city}&appid=${apiKey}&units=metric`;

        const response = await axios.get(url);
        const temperature = response.data.main.temp;

        return temperature;
    } catch (error) {
        console.error('Error fetching temperature:', error);
        return null;
    }
};

const sendDataToESP32 = async (data: string | number) => {
    try {
        const device = await manager.connectToDevice("8C:AA:B5:8C:50:52");
        const services = await device.discoverAllServicesAndCharacteristics();
        const service = (await services.services()).find(s => s.uuid === '4fafc201-1fb5-459e-8fcc-c5c9c331914b');
        const characteristic = (await service.characteristics()).find(c => c.uuid === 'beb5483e-36e1-4688-b7f5-ea07361b26a8');

        await characteristic.writeWithResponse(base64.encode(String(data)));
    } catch (error) {
        console.log(error);
    }
};

const handleDataRequest = async (error, characteristic) => {
  if(error) {
      console.error(error);
      return;
  }
  if (characteristic.value) {
      const decodedValue = base64.decode(characteristic.value);
      if (decodedValue === 'REQUEST_DATA') {
          const temperature = await getTemperatureData();
          if (temperature !== null) {
              await sendDataToESP32(temperature);
          }
      }
  }
};

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


  return false
}



const App = () => {

  const [device, setDevice] = useState(null);

    useEffect(() => {
        const setupBluetooth = async () => {
            try {
              await requestBluetoothPermission();

                const device = await manager.connectToDevice("8C:AA:B5:8C:50:52");
                setDevice(device);
                const services = await device.discoverAllServicesAndCharacteristics();
                const service = (await services.services()).find(s => s.uuid === '4fafc201-1fb5-459e-8fcc-c5c9c331914b');
                const characteristic = (await service.characteristics()).find(c => c.uuid === 'beb5483e-36e1-4688-b7f5-ea07361b26a8');
                const subscription = characteristic.monitor(handleDataRequest, null);
            } catch (error) {
                console.log('Connection failed:', error);
                // Retry connection
                setupBluetooth();
            }
        };

        setupBluetooth();
    }, []);

    return (
        <View>
            <Text>Bluetooth Data Exchange</Text>
            <Button
                title="Send Test Data"
                onPress={() => sendDataToESP32('Test Data')}
            />
        </View>
    );
};

export default App;
