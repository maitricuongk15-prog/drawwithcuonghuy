import React from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, {
  Circle as SvgCircle,
  Defs,
  Line as SvgLine,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect as SvgRect,
  Stop,
} from 'react-native-svg';

const HERO_IMAGE_SIGN_UP =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAQvewaQZGfHhVvGRXg9p5cYO8BnjaYNJveT2LF_fSkv2_yfG22wy1QyHWNrk4X9z5barxVhs5_S7zhAlGBiFjdaCgc8TtPWy7aW65cERiUXHwahCznZ2SgPCAQxv5JcqaTdx22jpnMSaCG4Cb9JHXMQtLD2guw2VVvkYg8hcbW3WAYD78zyk9B_aFa1kwrtN_GKhLEf5TyyuJKhsWOVQxzpwg4ad0Cpvy2zMCO9kk4m2rw1X18cup3xCjAxtUesMJECfAm7O-7BX0';
const HERO_IMAGE_SIGN_IN =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuC0UGuwPVShoYOtaUjI16djgEFp9JXSMP89sREGwYyrznJmGRzfh3pAxtaLE74LZrWIvpnw5_sIOOjYZfltcNGWOSdppPqa-Jl3N7g_yJoBClJPL_bUFt7ULzty3Kgm0mX_K1cIXT7OTwqXRD1kKbcwtBXjU2XjD99Bkp_hqWi19o-iYG5TOZ9TIqBidSXx47Fc2Ee5Ry8XHmtJFsTeIIj0UqkIfMpCSFHC5S7lhrdhYlagKhtbGL-4_QGbNV71P549ftYxGKlBgG8';

function FieldIcon({ type }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      {type === 'user' && (
        <>
          <SvgCircle cx="9" cy="6.1" r="3.1" fill="none" stroke="#637588" strokeWidth="1.4" />
          <Path d="M3.2 15.2 C3.2 11.7 14.8 11.7 14.8 15.2" fill="none" stroke="#637588" strokeWidth="1.4" />
        </>
      )}
      {type === 'display' && (
        <>
          <SvgRect x="2.4" y="4.4" width="13.2" height="9.2" rx="2" fill="none" stroke="#637588" strokeWidth="1.4" />
          <SvgLine x1="6" y1="9" x2="12" y2="9" stroke="#637588" strokeWidth="1.4" />
        </>
      )}
      {type === 'lock' && (
        <>
          <SvgRect x="4.1" y="7.5" width="9.8" height="7.2" rx="1.6" fill="none" stroke="#637588" strokeWidth="1.4" />
          <Path d="M6 7.5 V5.9 C6 4.2 7.3 3 9 3 C10.7 3 12 4.2 12 5.9 V7.5" fill="none" stroke="#637588" strokeWidth="1.4" />
        </>
      )}
    </Svg>
  );
}

export function AuthScreen({ auth, styles }) {
  const isSignIn = auth.isLogin;

  const renderField = ({
    label,
    placeholder,
    value,
    onChangeText,
    iconType,
    secureTextEntry = false,
    keyboardType = 'default',
    autoCapitalize = 'none',
  }) => (
    <View style={styles.authField}>
      <Text style={styles.authFieldLabel}>{label}</Text>
      <View style={styles.authInputShell}>
        <TextInput
          style={[styles.authInputControl, Platform.OS === 'web' && styles.authInputControlWeb]}
          placeholder={placeholder}
          placeholderTextColor="#637588"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={!auth.loading}
        />
        <View style={styles.authInputIconWrap}>
          <FieldIcon type={iconType} />
        </View>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.container, styles.authScreenContainer]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <Svg style={styles.authBackgroundGradient} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <SvgLinearGradient id="authBgGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#dbe3ec" />
            <Stop offset="60%" stopColor="#eef2f7" />
            <Stop offset="100%" stopColor="#ffffff" />
          </SvgLinearGradient>
        </Defs>
        <SvgRect x="0" y="0" width="100%" height="100%" fill="url(#authBgGradient)" />
      </Svg>
      <StatusBar barStyle="dark-content" backgroundColor="#dbe3ec" />
      <ScrollView contentContainerStyle={styles.authModernContainer}>
        <View style={styles.authTopBar}>
          <TouchableOpacity
            style={[styles.authBackButton, isSignIn && styles.authBackButtonGhost]}
            onPress={() => {
              if (!isSignIn) {
                auth.toggleAuthMode();
              }
            }}
            disabled={auth.loading || isSignIn}
          >
            <Text style={styles.authBackIcon}>{'<'}</Text>
          </TouchableOpacity>
          <Text style={styles.authTopTitle}>{isSignIn ? 'Sign In' : 'Sign Up'}</Text>
          <View style={styles.authTopRightSpace} />
        </View>

        <View style={styles.authHeroWrap}>
          <ImageBackground
            source={{ uri: isSignIn ? HERO_IMAGE_SIGN_IN : HERO_IMAGE_SIGN_UP }}
            style={[styles.authHeroImage, isSignIn && styles.authHeroImageSignIn]}
            imageStyle={styles.authHeroImageRadius}
            resizeMode="cover"
          >
            <View style={styles.authHeroOverlay} />
          </ImageBackground>
        </View>

        <View style={styles.authHeadingBlock}>
          <Text style={styles.authHeading}>{isSignIn ? 'Welcome Back' : 'Join the Canvas'}</Text>
          <Text style={styles.authBodyText}>
            {isSignIn
              ? 'Ready to create some masterpieces?'
              : 'Create an account to start guessing and drawing with friends!'}
          </Text>
        </View>

        <View style={styles.authFormBlock}>
          {renderField({
            label: 'Username',
            placeholder: isSignIn ? 'Enter your username' : 'DaVinci_23',
            value: auth.username,
            onChangeText: auth.setUsername,
            iconType: 'user',
          })}

          {!isSignIn &&
            renderField({
              label: 'Display Name',
              placeholder: 'Your display name',
              value: auth.displayName,
              onChangeText: auth.setDisplayName,
              iconType: 'display',
              autoCapitalize: 'words',
            })}

          {renderField({
            label: 'Password',
            placeholder: isSignIn ? 'Enter your password' : '********',
            value: auth.password,
            onChangeText: auth.setPassword,
            iconType: 'lock',
            secureTextEntry: true,
          })}
        </View>

        <View style={styles.authActionArea}>
          <TouchableOpacity
            style={[styles.authPrimaryButton, auth.loading && styles.authPrimaryButtonDisabled]}
            onPress={isSignIn ? auth.handleLogin : auth.handleRegister}
            disabled={auth.loading}
            activeOpacity={0.92}
          >
            {auth.loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <View style={styles.authPrimaryButtonInner}>
                <Text style={styles.authPrimaryButtonText}>Start Drawing</Text>
                {isSignIn ? (
                  <MaterialIcons name="arrow-forward" size={20} color="#ffffff" />
                ) : (
                  <MaterialIcons name="brush" size={20} color="#ffffff" />
                )}
              </View>
            )}
          </TouchableOpacity>
        </View>

        {!!auth.authStatus.message && (
          <View
            style={[
              styles.authStatusBox,
              auth.authStatus.type === 'success' && styles.authStatusSuccess,
              auth.authStatus.type === 'error' && styles.authStatusError,
              auth.authStatus.type === 'info' && styles.authStatusInfo,
            ]}
          >
            <Text style={styles.authStatusText}>{auth.authStatus.message}</Text>
          </View>
        )}

        <View style={styles.authFooterArea}>
          <Text style={styles.authFooterText}>
            {isSignIn ? "Don't have an account? " : 'Already have an account? '}
          </Text>
          <TouchableOpacity onPress={auth.toggleAuthMode} disabled={auth.loading}>
            <Text style={styles.authFooterLink}>{isSignIn ? 'Sign Up' : 'Sign In'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
