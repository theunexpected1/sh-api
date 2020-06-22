<?php

set_time_limit(0);

$slots1 = '"00:00","00:30","01:00","01:30","02:00","02:30","03:00","03:30","04:00","04:30","05:00","05:30","06:00","06:30","07:00","07:30","08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30","20:00","20:30","21:00","21:30","22:00","22:30","23:00","23:30"';
$slots2 = '"08:00","08:30","09:00","09:30","10:00","10:30","11:00","11:30","12:00","12:30","13:00","13:30","14:00","14:30","15:00","15:30","16:00","16:30","17:00","17:30","18:00","18:30","19:00","19:30"';

$rt = 901;
while ( $rt <= 1000) {
		
	if($rt <= 1) {
		$slots = $slots1;
		$hot_star = 4;
		$hot_rev = 9;
		$hot_slot = 3;
		$hot_amen = '["ac","tv","parking","coffee","lunch"]';
		$no_guests = 2;
	} else { 
		$slots = $slots2;
		$hot_star = 5;
		$hot_rev = 8;
		$hot_slot = 6;
		$hot_amen = '["ac","tv","parking","coffee"]';
		$no_guests = 3;
	}

	$html_main = '{"hotel_name":"Al Raien Holiday Homes Rentals LLC - ' . $rt . '","hotel_star":{"$numberInt":"' . $hot_star . '"},"hotel_review":{"$numberDecimal":"' . $hot_rev . '"},"hotel_review_text":"Very Good","hotel_slots":{"$numberInt":"' . $hot_slot . '"},"hotel_amenities":' . $hot_amen . ',"room_type":[ROOMTYPE_PLACEHOLDER]}';

	$rt_cnt = 1;
	$rt_disp = '';
	while ( $rt_cnt <= 2) {
		
		$rt_disp .= '{"name":"King Suite - ' . $rt_cnt . '","number_of_guests":{"$numberInt":"' . $no_guests . '"},"pricing":[PRICING_PLACEHOLDER],"booking":[BOOKING_SLOTS_PLACEHOLDER]},';

		$date1 = strtotime('2019-03-15');
		$date2 = strtotime('2019-06-14');
		$i = 0;
		$pricing_disp = $slot_disp = '';
		while ($date1 <= $date2) {
			$i++;
			//echo $i . ") " . date('Y-m-d', $date1) . "<br />";
			$pr = $i * $i;
			
			$date_disp = date('Y-m-d', $date1);
			$date1 = strtotime('+1 day', $date1);
			
			$pricing_disp .= '{"date":"' . $date_disp . '","price":{"$numberDecimal":"' . $pr . '"}},';
			$roomcount = 1;
			while ( $roomcount <= 2) {
				$slot_disp .= '{"room":{"$numberInt":"' . $roomcount . '"},"date":"' . $date_disp . '","slots":[SLOTS_PLACEHOLDER]},';
				
				$roomcount++;
			}
		}

		$pricing_disp = rtrim($pricing_disp, ",");
		$slot_disp = rtrim($slot_disp, ",");

		$rt_cnt++;
	}
	$rt_disp = rtrim($rt_disp, ",");
	
	$html_main = str_replace("ROOMTYPE_PLACEHOLDER", $rt_disp, $html_main);
	$html_main = str_replace("PRICING_PLACEHOLDER", $pricing_disp, $html_main);
	$html_main = str_replace("BOOKING_SLOTS_PLACEHOLDER", $slot_disp, $html_main);
	$html_main = str_replace("SLOTS_PLACEHOLDER", $slots, $html_main);
	
	$rt++;
		
	echo $html_main . "<br />";
}
