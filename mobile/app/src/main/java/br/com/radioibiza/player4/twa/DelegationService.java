package br.com.radioibiza.player4.twa;


import com.google.androidbrowserhelper.locationdelegation.LocationDelegationExtraCommandHandler;

import com.google.androidbrowserhelper.playbilling.digitalgoods.DigitalGoodsRequestHandler;


public class DelegationService extends
        com.google.androidbrowserhelper.trusted.DelegationService {
    @Override
    public void onCreate() {
        super.onCreate();

        
            registerExtraCommandHandler(new LocationDelegationExtraCommandHandler());
        
            registerExtraCommandHandler(new DigitalGoodsRequestHandler(getApplicationContext()));
        
    }
}

