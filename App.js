import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity,Button, SafeAreaView, ActivityIndicator } from 'react-native';
import { List, ListItem } from 'react-native-elements'
import { FontAwesome } from '@expo/vector-icons';
import FadeInView from './components/FadeInView';

import * as Permissions from 'expo-permissions';
import {Audio} from 'expo-av';
import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';
import * as Speech from 'expo-speech';

import SearchBox from './components/SearchBox';
import Hits from './components/Hits';
import { map } from 'rxjs/operator/map';

// const recordingOptions = {
//     // android not currently in use. Not getting results from speech to text with .m4a
//     // but parameters are required
//     android: {
//         extension: '.m4a',
//         outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
//         audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
//         sampleRate: 44100,
//         numberOfChannels: 2,
//         bitRate: 128000,
//     },
//     ios: {
//         extension: '.wav',
//         audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
//         sampleRate: 44100,
//         numberOfChannels: 1,
//         bitRate: 128000,
//         linearPCMBitDepth: 16,
//         linearPCMIsBigEndian: false,
//         linearPCMIsFloat: false,
//     },
// };

const recordingOptions = JSON.parse(JSON.stringify(Audio.RECORDING_OPTIONS_PRESET_LOW_QUALITY));

const slownik = {
"jeden" : 1,
"dwa" : 2,
"trzy" : 3,
"cztery" : 4,
"pięć" : 5,
"sześć" : 6,
"siedem" : 7,
"osiem" : 8,
"dziewięć" : 9,
"plus" : "+"
}

export default class App extends React.Component {
    constructor(props) {
        super(props);
        this.recording = null;
        this.text =''
        this.state = {
            isFetching: false,
            isRecording: false,
            query: '',
            users: []
          }
        this.speak = this.speak.bind(this);
    }

    addUser(data){
      var mowa = data
              mowa = mowa.replace('nowa gra ', '')
              const userList = mowa.split(' ');
      console.log(userList);
              const players  = [];
              userList.forEach(user=>{
                const player = {name: user, punkty: 0}
                players.push(player)
              })
      this.setState({users: players});
    }

    updateScore(data){
      var dodaj = data
      const zawodnicy = dodaj.split(' ')
      const osoba = zawodnicy[1]

      let users = [...this.state.users];
      let index = users.findIndex(el => el.name.toLowerCase() === osoba.toLowerCase());
      let points = parseInt(users[index].punkty)
      let count = this.countPoints(dodaj);

      users[index] = {...users[index], punkty: count + points}
      this.setState({ users });
    }

    gameOver(){
      let users = [...this.state.users];
      let sorted = users.sort((a, b) => b.punkty - a.punkty)
      let wygrany = "Wygral player : " + sorted[0].name
      this.setState({query: wygrany})


    }

    speak() {
      var opt = new Map()
      opt.set("language", "pl-PL")
      Speech.speak(this.state.query, opt);
    }

    componentDidUpdate(prevProps, prevState) {
        const { query } = this.state;
        if (prevState.query === null && query !== null) {
            // update search
        }
    }

    deleteRecordingFile = async () => {
        console.log("Deleting file");
        try {
            const info = await FileSystem.getInfoAsync(this.recording.getURI());
            await FileSystem.deleteAsync(info.uri)
        } catch(error) {
            console.log("There was an error deleting recording file", error);
        }
    }

    getTranscription = async () => {
        this.setState({ isFetching: true });
        try {
            const info = await FileSystem.getInfoAsync(this.recording.getURI());
            console.log(`FILE INFO: ${JSON.stringify(info)}`);
            const uri = info.uri;
            const formData = new FormData();
            formData.append('file', {
                uri,
                type: 'audio/m4a',
                name: new Date() + '.m4a'
            });
            const response = await fetch('http://10.10.1.149:3005/speech', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            console.log(data);

            this.setState({ query: data.transcript });
            this.text += "\n";
            this.text += this.countPoints(data.transcript);

            if(data.transcript.includes('nowa gra')){
              this.addUser(data.transcript)
          }
          if(data.transcript.toLowerCase().includes('dodaj')){
            this.updateScore(data.transcript)
          }
          if(data.transcript.toLowerCase().includes('koniec')){
            this.gameOver()
          }

        } catch(error) {
            console.log('There was an error reading file', error);
            this.stopRecording();
            this.resetRecording();
        }

        this.setState({ isFetching: false });
    }

    startRecording = async () => {
        const { status } = await Permissions.askAsync(Permissions.AUDIO_RECORDING);
        if (status !== 'granted') return;

        this.setState({ isRecording: true });

        const recording = new Audio.Recording();
        try {
          await recording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
          await recording.startAsync();
          // You are now recording!
        } catch (error) {
          console.log(error);
          this.stopRecording();
        }

        this.recording = recording;
    }

    stopRecording = async () => {
        this.setState({ isRecording: false });
        try {
            await this.recording.stopAndUnloadAsync();
        } catch (error) {
            // Do nothing -- we are already unloaded.
        }
    }

    resetRecording = () => {
        this.deleteRecordingFile();
        this.recording = null;
    }

    handleOnPressIn = () => {
        this.startRecording();
    }

    handleOnPressOut = () => {
        this.stopRecording();
        this.getTranscription();
    }

    handlQueryChange = (query) => {
        this.setState({ query });
    }

    countPoints = (bla) => {
      if (bla == '') return 0;
      const mowionko = bla.toLowerCase();
      var slowa = mowionko.split(' ');
      console.log(slowa);
      var liczby = []

      slowa.forEach(function(slowo){
        if (slowo === "plus") {
        } else if (Number.isNaN(parseInt(slowo))) {
          if (typeof slownik[slowo] !== "undefined") {
            liczby.push(parseInt(slownik[slowo]));
          }
        } else {
          liczby.push(parseInt(slowo));
        }

      });

      var result = 0;

      liczby.forEach(function(liczba){
        result += liczba;
      });

      return result;
    }

    render() {

        const { isRecording, query, isFetching } = this.state;
        return (
            <SafeAreaView style={{flex: 1}}>
                <View style={styles.container}>
                    {isRecording &&
                        <FadeInView>
                            <FontAwesome name="microphone" size={32} color="#48C9B0" />
                        </FadeInView>
                    }
                    {!isRecording &&
                        <FontAwesome name="microphone" size={32} color="#48C9B0" />
                    }
                    <Text> )) mówionko (( </Text>
                    <TouchableOpacity
                        style={styles.button}
                        onPressIn={this.handleOnPressIn}
                        onPressOut={this.handleOnPressOut}
                    >
                        {isFetching && <ActivityIndicator color="#ffffff" />}
                        {!isFetching && <Text> Naciśnij i mów </Text>}
                    </TouchableOpacity>
                </View>
                <View style={{paddingHorizontal: 20}}>
                  <Text>Tutaj będzie tekst: </Text>
                      {
                       this.state.users.map((item, i) => (
                        <ListItem
                          key={i}
                          title={item.name}
                          subtitle ={ Number.isNaN(item.punkty) ? 0 : item.punkty.toString() }
                          bottomDivider

                        />
                      ))
                      }

                  <Text style={styles.text}>{query}</Text>
                  <Text>{this.text}</Text>
                  <Button title="Odsłuchaj" onPress={this.speak} />
                </View>
            </SafeAreaView>
        );
    }
}

const styles = StyleSheet.create({
    container: {
        marginTop: 40,
        backgroundColor: '#fff',
        alignItems: 'center',
    },
    button: {
        backgroundColor: '#48C9B0',
        paddingVertical: 20,
        width: '90%',
        alignItems: 'center',
        borderRadius: 5,
        marginTop: 20,
    },
    text: {
      margin: 24,
      fontSize: 18,
      fontWeight: 'bold',
      textAlign: 'center',
    }
});
