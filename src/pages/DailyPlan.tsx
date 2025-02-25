
import TopBar from "@/components/TopBar";
import DateNavigator from "@/components/DateNavigator";
import DailyGrid from "@/components/DailyGrid";
import BookingModal from "@/components/BookingModal";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

const DailyPlan = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Find and remove any existing viewport meta tag
    const existingViewport = document.querySelector('meta[name="viewport"]');
    if (existingViewport) {
      existingViewport.remove();
    }

    // Create a new viewport meta tag that allows zooming
    const viewport = document.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes';
    document.head.appendChild(viewport);

    // Cleanup function to restore default viewport settings
    return () => {
      viewport.remove();
      const defaultViewport = document.createElement('meta');
      defaultViewport.name = 'viewport';
      defaultViewport.content = 'width=device-width, initial-scale=1.0';
      document.head.appendChild(defaultViewport);
    };
  }, []);

  const handleOpenNewBookingModal = () => {
    setIsNewBookingModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <TopBar pageTitle="Daily Plan" onNewBookingClick={handleOpenNewBookingModal} />
      <main className="pt-20 px-4">
        <div className="max-w-7xl mx-auto">
          <DateNavigator date={selectedDate} onDateChange={setSelectedDate} />
          <DailyGrid selectedDate={selectedDate} />
          <BookingModal
            isOpen={isNewBookingModalOpen}
            onClose={() => setIsNewBookingModalOpen(false)}
            onSubmit={async (data) => {
              try {
                const { error } = await supabase
                  .from('bookings')
                  .insert([
                    {
                      name: data.name,
                      pickup_location: data.pickup_location,
                      number_of_people: data.number_of_people,
                      phone: data.phone,
                      email: data.email,
                      tag_id: data.tag_id,
                      booking_date: data.booking_date,
                      time_slot: data.time_slot,
                    }
                  ]);

                if (error) throw error;

                setIsNewBookingModalOpen(false);
                queryClient.invalidateQueries(['bookings']);
                toast({
                  title: "Success",
                  description: "Booking created successfully",
                });
              } catch (error) {
                console.error('Error creating booking:', error);
                toast({
                  variant: "destructive",
                  title: "Error",
                  description: "Failed to create booking",
                });
              }
            }}
            selectedDate=""
            timeSlot=""
            maxPeople={100}
          />
        </div>
      </main>
    </div>
  );
};

export default DailyPlan;
