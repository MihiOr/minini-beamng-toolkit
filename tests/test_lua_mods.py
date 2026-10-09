import json
from pathlib import Path
import unittest
from lupa.luajit21 import LuaRuntime

ROOT=Path(__file__).resolve().parents[1]


class LuaModTests(unittest.TestCase):
    def test_all_lua_sources_compile_in_luajit(self):
        lua=LuaRuntime()
        paths=list((ROOT/'mods').rglob('*.lua'))
        self.assertTrue(paths,'No Lua sources found')
        for path in paths:
            with self.subTest(file=path.relative_to(ROOT).as_posix()):
                lua.compile(path.read_text())

    def test_mouse_toggle_preserves_other_bindings_and_uses_direct_filter(self):
        lua=LuaRuntime()
        lua.execute('''
          events={};saved=nil;reset=false
          function deepcopy(v) if type(v)~='table' then return v end
            local out={} for k,x in pairs(v) do out[k]=deepcopy(x) end return out end
          core_input_bindings={bindings={{devname='mouse0',contents={bindings={
            {action='camera',control='yaxis'}}}}},saveBindingsToDisk=function(data)
              saved=data;core_input_bindings.bindings[1].contents=data end}
          guihooks={message=function(text) table.insert(events,text) end}
          be={getPlayerVehicle=function() return {queueLuaCommand=function() reset=true end} end}
          log=function() end
        ''')
        mod=lua.execute((ROOT/'mods/CompanionMouseSteering/lua/ge/extensions/companionMouseSteering.lua').read_text())
        mod.toggle()
        self.assertEqual(lua.globals().saved.bindings[1].action,'camera')
        steering=lua.globals().saved.bindings[2]
        self.assertEqual(steering.action,'steering')
        self.assertEqual(steering.filterType,2)
        self.assertEqual(steering.control,'xaxis')
        mod.onUpdate(.6);mod.toggle()
        self.assertEqual(len(lua.globals().saved.bindings),1)
        self.assertEqual(lua.globals().saved.bindings[1].action,'camera')
        self.assertTrue(lua.globals().reset)

    def test_telemetry_matches_gmeter_and_sends_only_while_active(self):
        lua=LuaRuntime(unpack_returned_tuples=True)
        messages=[]
        lua.globals().jsonEncode=lambda t:json.dumps({'schema':t.schema,'values':dict(t['values'].items())})
        lua.globals().send=lambda data:messages.append(json.loads(data))
        lua.execute('''
          socket={udp=function() return {settimeout=function() end,setpeername=function() end,
            send=function(self,data) send(data) end,close=function() end} end}
          obj={getVelocity=function() return {length=function() return 20 end} end,
            getGravity=function() return -9.81 end,getID=function() return 1 end,
            getEnvTemperature=function() return 298.15 end}
          electrics={values={gearIndex=1,signal_left_input=1,lowbeam=true,parkingbrake=0}}
          input={throttle=.5,brake=0,steering=-.25}
          sensors={gy2=9.81,gx2=-4.905}
          energyStorage={getStorages=function() return {} end}
        ''')
        mod=lua.execute((ROOT/'mods/CompanionDashboard/lua/vehicle/extensions/companionDashboardTelemetry.lua').read_text())
        mod.updateGFX(.1);self.assertEqual(messages,[])
        mod.setActive(True);mod.updateGFX(.1)
        self.assertEqual(messages[-1]['schema'],1)
        values=messages[-1]['values']
        self.assertEqual(values['longitudinalG'],1)
        self.assertEqual(values['lateralG'],-.5)
        self.assertEqual(values['speedKmh'],72)
        self.assertEqual(values['gear'],2)
        self.assertEqual(values['leftTurn'],1)
        self.assertNotIn('remainingKwh',values)
        count=len(messages);mod.setActive(False);mod.updateGFX(.1)
        self.assertEqual(len(messages),count)
