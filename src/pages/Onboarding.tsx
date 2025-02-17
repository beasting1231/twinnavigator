
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserRole } from "@/types/auth";

const Onboarding = () => {
  const { updateProfile } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    username: "",
    role: "" as UserRole,
    gender: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < (formData.role === "pilot" ? 3 : 2)) {
      setStep(step + 1);
      return;
    }

    const profileData = {
      ...formData,
      is_onboarded: true,
    };

    if (formData.role !== "pilot") {
      delete profileData.gender;
    }

    await updateProfile(profileData);
    navigate("/daily-plan");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-6 space-y-6 backdrop-blur-xl bg-background/80 border-2">
        <h1 className="text-2xl font-bold text-center">Complete Your Profile</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Choose your username</Label>
                <Input
                  placeholder="Username"
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  required
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Label>What is your role?</Label>
              <RadioGroup
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value as UserRole })
                }
                className="grid grid-cols-1 gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="pilot" id="pilot" />
                  <Label htmlFor="pilot">Pilot</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="driver" id="driver" />
                  <Label htmlFor="driver">Driver</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="agency" id="agency" />
                  <Label htmlFor="agency">Agency</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          {step === 3 && formData.role === "pilot" && (
            <div className="space-y-4">
              <Label>What is your gender?</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) =>
                  setFormData({ ...formData, gender: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <Button type="submit" className="w-full">
            {step < (formData.role === "pilot" ? 3 : 2) ? "Next" : "Complete"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default Onboarding;
