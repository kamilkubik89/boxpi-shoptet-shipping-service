import { Router, Request, Response } from "express";

const router = Router();

type PickupPoint = {
  id: string;
  name: string;
  city: string;
  address: string;
  zip: string;
  carrier: string;
  openingHours?: string;
};

function getMockPointsByCarrier(carrier: string): PickupPoint[] {
  const normalized = carrier.toUpperCase();

  if (normalized === "PACKETA-POINT-SK") {
    return [
      {
        id: "packeta-ba-1",
        name: "Packeta Partner Bratislava Centrum",
        city: "Bratislava",
        address: "Obchodná 12",
        zip: "81106",
        carrier: normalized,
        openingHours: "Po-Pia 09:00-18:00",
      },
      {
        id: "packeta-ke-1",
        name: "Packeta Z-BOX Košice Aupark",
        city: "Košice",
        address: "Námestie osloboditeľov 1",
        zip: "04001",
        carrier: normalized,
        openingHours: "Po-Ne 00:00-23:59",
      },
      {
        id: "packeta-za-1",
        name: "Packeta Partner Žilina Mirage",
        city: "Žilina",
        address: "Námestie Andreja Hlinku 7",
        zip: "01001",
        carrier: normalized,
        openingHours: "Po-Ne 09:00-20:00",
      },
    ];
  }

  if (normalized === "GLS-POINT-SK") {
    return [
      {
        id: "gls-ba-1",
        name: "GLS ParcelShop Bratislava",
        city: "Bratislava",
        address: "Karadžičova 8",
        zip: "82108",
        carrier: normalized,
        openingHours: "Po-Pia 08:00-18:00",
      },
      {
        id: "gls-tt-1",
        name: "GLS ParcelShop Trnava",
        city: "Trnava",
        address: "Hlavná 15",
        zip: "91701",
        carrier: normalized,
        openingHours: "Po-So 09:00-19:00",
      },
    ];
  }

  if (normalized === "SPS-POINT-SK") {
    return [
      {
        id: "sps-ba-1",
        name: "SPS Výdajné miesto Bratislava",
        city: "Bratislava",
        address: "Račianska 22",
        zip: "83102",
        carrier: normalized,
        openingHours: "Po-Pia 08:30-17:30",
      },
    ];
  }

  return [
    {
      id: "default-1",
      name: "Test Pickup Point",
      city: "Bratislava",
      address: "Testovacia 1",
      zip: "81101",
      carrier: normalized || "PACKETA-POINT-SK",
      openingHours: "Po-Pia 09:00-17:00",
    },
  ];
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const carrier = String(req.query.carrier || "PACKETA-POINT-SK").trim();
    const search = String(req.query.search || "").trim().toLowerCase();

    let points = getMockPointsByCarrier(carrier);

    if (search) {
      points = points.filter((point) =>
        [
          point.id,
          point.name,
          point.city,
          point.address,
          point.zip,
          point.openingHours || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(search)
      );
    }

    return res.status(200).json({
      success: true,
      carrier,
      count: points.length,
      points,
    });
  } catch (error) {
    console.error("Pickup points route error:", error);

    return res.status(500).json({
      success: false,
      error: "Failed to load pickup points",
      points: [],
    });
  }
});

export default router;