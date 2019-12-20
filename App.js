import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity,Button, SafeAreaView, ActivityIndicator,  ScrollView} from 'react-native';
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
import { createStackNavigator } from 'react-navigation-stack';
import { createAppContainer } from 'react-navigation';

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

class MainApp extends React.Component {
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
      var gracze = 'Zaczynamy! Gracze: ';
      console.log(userList);
              const players  = [];
              userList.forEach(user=>{
                const player = {name: user, punkty: 0, text: ''}
                gracze += ', '+ user
                players.push(player)
              })
      gracze = gracze.replace(', ', '')
      this.setState({users: players});
      this.setState({query : gracze})
    }

    updateScore(data){
      var dodaj = data
      const zawodnicy = dodaj.split(' ')
      const osoba = zawodnicy[1]

      let users = [...this.state.users];
      let index = users.findIndex(el => el.name.toLowerCase() === osoba.toLowerCase());
      let points = parseInt(users[index].punkty);
      let count = this.countPoints(dodaj);
      let text = users[index].text+ ' ' + count;

      users[index] = {...users[index], punkty: count + points, text: text}
      this.setState({ users });
      let sorted = users.sort((a, b) => b.punkty - a.punkty)
      let wygrywa = "Wygrywa : " + sorted[0].name + ' punkty ' + sorted[0].punkty;
      this.setState({query: wygrywa})

    }

    gameOver(){
      let users = [...this.state.users];
      let sorted = users.sort((a, b) => b.punkty - a.punkty)
      let wygrany = "Wygrał : " + sorted[0].name + ' gratulacje'
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
            //this.text += "\n";
            //this.text += this.countPoints(data.transcript);

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


    sendResults = async () => {
        if (!this.state.users.length) {
            console.log("nu ma nu ma nej");
        } else {
            console.log(JSON.stringify(this.state.users));
            try {
                const response = await fetch('https://shipit-d1d3.restdb.io/rest/wyniki', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        "x-apikey": "5c2e8ccd66292476821c9cb3",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({"data": new Date(), "wyniki": this.state.users})
                });
                const data = await response.json();
                console.log(data);
            } catch(error) {
                console.log('There was an error sending results', error);
            }
        }

    };



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
                    <Button style={styles.button}
                            title="Pokaż historię wynikow"
                            onPress={() => {this.props.navigation.navigate('Details')}} />

                </View>
                <View style={{height: 160}} >
                  <ScrollView style = {styles.scrollView} contentContainerStyle={styles.contentContainer}>
                      {
                       this.state.users.map((item, i) => (
                        <ListItem containerStyle={{borderRadius: 5}}
                          key={i}
                          title={item.name}
                          subtitle ={ Number.isNaN(item.punkty) ? 0 : item.punkty.toString() }
                          rightSubtitle = {item.text}
                          bottomDivider
                          linearGradientProps={{
                            colors: ['#FF9800', '#F44336'],
                            start: [1, 0],
                            end: [0.2, 0],
                          }}

                        />
                      ))
                      }
                  </ScrollView>
                </View>
                <View style={{paddingHorizontal: 20}}>
                  <Text style={styles.text}>{query}</Text>
                  <Text>{this.text}</Text>
                  <Button title="Odsłuchaj" onPress={this.speak} />
                </View>
                <View style={{paddingHorizontal: 60}}>
                    <FontAwesome style={styles.icon}
                                 name="gamepad"s
                                 size={32}
                                 color="#000000" />
                    <Button style={styles.button}
                            title="Zapisz wyniki"
                            onPress={this.sendResults} />

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
    scrollView: {
      backgroundColor: 'pink',
      marginHorizontal: 10,
      marginVertical: 10,
      borderRadius: 5,
    },
    contentContainer: {
      paddingVertical: 0
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
      margin: 4,
      fontSize: 18,
      fontWeight: 'bold',
      textAlign: 'center',
    },
    icon: {
        margin: 24,
        fontSize: 32,
        fontWeight: 'bold',
        textAlign: 'center',
    }
});

class DetailsScreen extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            wyniki: []
        }
        this.getResults();
    }

    getResults = async () => {
        try {
            const response = await fetch('https://shipit-d1d3.restdb.io/rest/wyniki', {
                method: 'GET',
                headers: {
                    "x-apikey": "5c2e8ccd66292476821c9cb3",
                    "Content-Type": "application/json"
                }
            });
            const data = await response.json();
            console.log(data);
            this.setState({wyniki : data});
            return data;
        } catch(error) {
            console.log('There was an error getting results', error);
        }


    };

    render() {
        const { wyniki } = this.state;
        return (
            <View style={{height : 600}}>
                <ScrollView style = {styles.scrollView} contentContainerStyle={styles.contentContainer}>
                    {
                        wyniki.map((item, i) => (
                            <ListItem
                            key={i}
                            title={item.data}
                            subtitle={JSON.stringify(item.wyniki)}
                            bottomDivider
                            />
                        ))
                    }
                </ScrollView>
                <Button
                    title="Go back"
                    onPress={() => this.props.navigation.goBack()}
                />
                <Text> {JSON.stringify(wyniki)} </Text>

            </View>
        );
    }
}
const RootStack = createStackNavigator({
        Home: { screen: MainApp },
        Details: { screen: DetailsScreen }
    },
    {
        initialRouteName: 'Home',
    });

const AppContainer = createAppContainer(RootStack);
export default AppContainer;