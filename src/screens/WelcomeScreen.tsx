import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  Dimensions,
} from "react-native";

const { width } = Dimensions.get("window");

export default function WelcomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* TOP BACKGROUND SHAPES */}
      <View style={styles.topSection}>
        <View style={styles.shapeLeft} />
        <View style={styles.shapeRight} />
        
        {/* LOGIN PAGE WALA SAME "MY HRMS" DESIGN YAHAN HAI */}
        <View style={styles.titleWrapper}>
          <Text style={styles.headerTitle}>My HRMS</Text>
          <View style={styles.titleUnderline} /> 
        </View>
      </View>

      {/* ILLUSTRATION AREA */}
      <View style={styles.illustrationContainer}>
        <Image
          source={require("../assets/hrms_illustration.png")} 
          style={styles.illustration}
          resizeMode="contain"
        />
      </View>

      {/* BOTTOM WELCOME CARD */}
      <View style={styles.bottomCard}>
        <Text style={styles.welcomeTitle}>Welcome!</Text>
        <Text style={styles.description}>
          Simplify your HR management with our all-in-one professional solution. 
          Manage attendance, leaves, and payroll seamlessly.
        </Text>

        <TouchableOpacity 
          style={styles.signInBtn}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.8}
        >
          <Text style={styles.signInText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  topSection: {
    height: 180, 
    width: '100%',
    position: 'relative',
  },
  shapeRight: {
    position: "absolute",
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: "#151965",
    top: -200, 
    right: -100,   
    zIndex: 2,
  },
  shapeLeft: {
    position: "absolute",
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: "#5DADE2",
    top: -150,  
    left: -180, 
    zIndex: 1,
  },
  // --- ADDED TITLE STYLING TO MATCH LOGIN PAGE ---
  titleWrapper: {
    position: "absolute",
    top: 60, // Exact same top position as login
    right: 30, // Exact same right position as login
    zIndex: 5,
    alignItems: 'flex-end'
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  titleUnderline: {
    width: 40,
    height: 4,
    backgroundColor: '#5DADE2',
    marginTop: 4,
    borderRadius: 2
  },
  // ---------------------------------------------
  illustrationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 10,
  },
  illustration: {
    width: width * 0.85,
    height: width * 0.85,
  },
  bottomCard: {
    backgroundColor: "#1976D2",
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    padding: 40,
    paddingBottom: 50,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  welcomeTitle: {
    fontSize: 34,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.8)",
    lineHeight: 24,
    marginBottom: 35,
  },
  signInBtn: {
    backgroundColor: "#FFFFFF",
    padding: 18,
    borderRadius: 15,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  signInText: {
    color: "#1976D2",
    fontWeight: "800",
    fontSize: 18,
    letterSpacing: 1,
  },
});