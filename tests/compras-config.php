<?php
declare(strict_types=1);
require_once __DIR__.'/../compras-lib.php';
function check($value,$message){if(!$value)throw new RuntimeException($message);}
$base=['enabled'=>'1','gas_url'=>'https://script.google.com/macros/s/test/exec','hmac_key'=>str_repeat('a',64),'origin'=>'https://portal2.ciarm.edu.mx'];
check(ciarm_compras_config_valid($base),'valid configuration');
foreach(['enabled','gas_url','hmac_key','origin'] as $field){$bad=$base;unset($bad[$field]);check(!ciarm_compras_config_valid($bad),'missing '.$field.' must fail closed');}
check(!ciarm_compras_writes_enabled($base),'writes disabled by default');
check(ciarm_compras_writes_enabled($base+['writes_enabled'=>'1']),'explicit write enable');
check(!ciarm_compras_config_valid(array_replace($base,['gas_url'=>'https://example.com/exec'])),'untrusted destination');
check(!ciarm_compras_config_valid(array_replace($base,['hmac_key'=>'short'])),'short key');
check(!ciarm_compras_config_valid(array_replace($base,['origin'=>'http://portal2.ciarm.edu.mx'])),'HTTPS required');
check(ciarm_compras_shape('misPedidos',[])===[],'read payload');
try{ciarm_compras_shape('misPedidos',['actor'=>'other@ciarm.edu.mx']);throw new Exception('accepted actor');}catch(RuntimeException $e){check($e->getMessage()==='INVALID_REQUEST','identity injection blocked');}
check(ciarm_compras_actions()['crearSolicitud'][0]==='POST','create is write');
check(ciarm_compras_actions()['misPedidos'][0]==='GET','list is read');
echo "Compras configuration: PASS\n";
