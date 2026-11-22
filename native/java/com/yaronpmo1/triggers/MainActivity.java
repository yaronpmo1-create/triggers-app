package com.yaronpmo1.triggers;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        Ota.guard(this);
        registerPlugin(TriggersPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
